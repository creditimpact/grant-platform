import re
from datetime import datetime
from typing import Any, Dict, List, Optional

# Match EIN even when digits are separated by spaces or rendered in
# individual OCR tokens (e.g. "3 3 - 1 3 4 0 4 8 2"). Allow optional
# whitespace between all digits and an optional hyphen after the first two
# digits. Canonical format is still two digits, optional hyphen, then seven
# digits.
EIN_RE = re.compile(r"\b(?:\d[\s]*){2}(?:-\s*)?(?:\d[\s]*){7}\b")
SSN_RE = re.compile(r"\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b")
DATE_PATS = [
    r"\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b",
    r"\b[A-Za-z]{3,9}\s+\d{1,2},\s+\d{4}\b",
]

ENTITY_TYPE_RE = re.compile(
    r"\b(LLC|Limited Liability Company|Corporation|C[ -]?Corp|S[ -]?Corp|Sole\s+Propriet(?:or|orship)|Partnership|Nonprofit)\b",
    flags=re.IGNORECASE,
)

ENTITY_TYPE_STOP_RE = re.compile(
    r"(Limited Liability Company|Corporation|C[ -]?Corp|S[ -]?Corp|Sole\s+Propriet(?:or|orship)|Partnership|Nonprofit)",
    flags=re.IGNORECASE,
)


def _clean(value: str) -> str:
    """Normalize whitespace and strip trailing punctuation."""
    return re.sub(r"\s+", " ", value).strip(" \t,:;-")


def detect(text: str) -> bool:
    tl = text.lower()
    needles = [
        "form w-9",
        "request for taxpayer identification number and certification",
        "request for taxpayer identification number",
        "rev. october",
        "taxpayer identification number",
        "tin",
    ]
    return any(n in tl for n in needles)


def _parse_date(text: str) -> Optional[tuple[str, str]]:
    """Return (raw, iso) date strings if a date is found."""
    for pat in DATE_PATS:
        m = re.search(pat, text)
        if m:
            raw = m.group(0)
            for fmt in (
                "%m/%d/%Y",
                "%m-%d-%Y",
                "%m/%d/%y",
                "%m-%d-%y",
                "%B %d, %Y",
                "%b %d, %Y",
            ):
                try:
                    iso = datetime.strptime(raw, fmt).date().isoformat()
                    return raw, iso
                except Exception:
                    pass
    return None


INSTRUCTION_RE = re.compile(
    r"(name is required.*|do not leave blank|enter if applicable|broker transactions.*|this is where you should enter your address.*|do not write here.*)",
    flags=re.IGNORECASE,
)


def _strip_instructions(value: str) -> str:
    return INSTRUCTION_RE.sub("", value)


def _extract_labeled_field(
    lines: List[str], label_re: str, stop_res: List[str]
) -> tuple[Optional[str], Optional[str]]:
    """Return raw and cleaned text for a labeled field."""
    raw_collected: List[str] = []
    clean_collected: List[str] = []
    start: Optional[int] = None

    for idx, line in enumerate(lines):
        if start is None and re.search(label_re, line, flags=re.IGNORECASE):
            after = re.sub(label_re, "", line, flags=re.IGNORECASE).strip(" :-/\t")
            after = re.sub(r"/.*", "", after).strip()
            if after:
                raw_collected.append(after)
                clean_after = _strip_instructions(after)
                if clean_after:
                    clean_collected.append(clean_after)
            start = idx + 1
            continue
        if start is not None:
            nxt = lines[idx].strip()
            if not nxt:
                continue
            if any(re.search(pat, nxt, flags=re.IGNORECASE) for pat in stop_res):
                break
            raw_collected.append(nxt)
            clean_nxt = _strip_instructions(nxt)
            if clean_nxt:
                clean_collected.append(clean_nxt)
    if raw_collected:
        raw = _clean(" ".join(raw_collected))
        clean = _clean(" ".join(clean_collected)) if clean_collected else None
        return raw, clean
    return None, None


def _extract_signature_date(text: str) -> tuple[Optional[str], Optional[str]]:
    lines = text.splitlines()
    for i, line in enumerate(lines):
        if re.search(r"signature", line, flags=re.IGNORECASE):
            snippet = "\n".join(lines[i : i + 3])
            dt = _parse_date(snippet)
            if dt:
                raw, iso = dt
                return _clean(raw), _clean(iso)
    return None, None


def extract(text: str, evidence_key: Optional[str] = None) -> Dict[str, Any]:
    if not detect(text):
        return {
            "doc_type": None,
            "confidence": 0.0,
            "fields": {},
            "evidence_key": evidence_key,
        }

    ein = EIN_RE.search(text)
    ssn = SSN_RE.search(text)
    tin_raw = None
    tin_clean = None
    if ein:
        tin_raw = ein.group(0)
        digits = re.sub(r"\D", "", tin_raw).strip()
        tin_clean = f"{digits[:2]}-{digits[2:]}"
    elif ssn:
        tin_raw = ssn.group(0)
        digits = re.sub(r"\D", "", tin_raw).strip()
        tin_clean = f"{digits[:3]}-{digits[3:5]}-{digits[5:]}"

    lines = text.splitlines()

    legal_name_raw, legal_name_clean = _extract_labeled_field(
        lines,
        r"^\s*1\s*Name\s*(?:\(as shown on your income tax return\))?\s*[:\-]?",
        [r"^\s*2\b", r"^\s*Business name", r"^\s*\d+\b", ENTITY_TYPE_STOP_RE.pattern],
    )

    business_name_raw, business_name_clean = _extract_labeled_field(
        lines,
        r"^\s*2\s*Business name(?:/disregarded entity name, if different from above)?\s*[:\-]?",
        [r"^\s*3\b", r"^\s*Check", r"^\s*\d+\b", ENTITY_TYPE_STOP_RE.pattern],
    )

    entity_raw = None
    entity_clean = None
    et = ENTITY_TYPE_RE.search(text)
    if et:
        entity_raw = _clean(et.group(0))
        entity_clean = entity_raw

    address_raw = None
    address_clean = None
    addr_lines: List[str] = []
    for i, line in enumerate(lines):
        if re.search(r"Address\s*\(number,\s*street", line, flags=re.IGNORECASE):
            if i + 1 < len(lines):
                addr_lines.append(lines[i + 1].strip())
        if re.search(r"City,\s*state,\s*and\s*ZIP", line, flags=re.IGNORECASE):
            if i + 1 < len(lines):
                addr_lines.append(lines[i + 1].strip())
    if addr_lines:
        address_raw = _clean(", ".join(addr_lines))
        address_clean = _clean(_strip_instructions(address_raw))
    if not address_raw:
        for line in lines:
            if re.search(r"\b[A-Z]{2}\s+\d{5}(-\d{4})?\b", line):
                address_raw = _clean(line)
                address_clean = _clean(_strip_instructions(address_raw))
                break

    date_signed_raw, date_signed_clean = _extract_signature_date(text)

    fields: Dict[str, Any] = {}
    fields_clean: Dict[str, Any] = {}
    if legal_name_raw:
        fields["legal_name"] = legal_name_raw
    if legal_name_clean:
        fields_clean["legal_name"] = legal_name_clean
    if business_name_raw:
        fields["business_name"] = business_name_raw
    if business_name_clean:
        fields_clean["business_name"] = business_name_clean
    if entity_raw:
        fields["entity_type"] = entity_raw
    if entity_clean:
        fields_clean["entity_type"] = entity_clean
    if tin_raw:
        fields["tin"] = _clean(tin_raw)
    if tin_clean:
        fields_clean["tin"] = tin_clean
    if address_raw:
        fields["address"] = address_raw
    if address_clean:
        fields_clean["address"] = address_clean
    if date_signed_raw:
        fields["date_signed"] = date_signed_raw
    if date_signed_clean:
        fields_clean["date_signed"] = date_signed_clean

    conf = 0.6 + (0.1 if tin_clean else 0) + (0.1 if legal_name_clean else 0)

    return {
        "doc_type": "W9_Form",
        "confidence": min(conf, 0.95),
        "fields": fields,
        "fields_clean": fields_clean,
        "evidence_key": evidence_key,
    }


__all__ = ["detect", "extract"]
