import re
from datetime import datetime
from typing import Any, Dict, List, Optional

EIN_RE = re.compile(r"\b\d{2}[-\s]?\d{7}\b")
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


def _parse_date(text: str) -> Optional[str]:
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
                    return datetime.strptime(raw, fmt).date().isoformat()
                except Exception:
                    pass
    return None


def _extract_labeled_field(
    lines: List[str], label_re: str, stop_res: List[str]
) -> Optional[str]:
    """Extract text following a label until a stop pattern is reached."""
    collected: List[str] = []
    start: Optional[int] = None
    for idx, line in enumerate(lines):
        if start is None and re.search(label_re, line, flags=re.IGNORECASE):
            after = re.sub(label_re, "", line, flags=re.IGNORECASE).strip(" :-/\t")
            after = re.sub(r"/.*", "", after).strip()
            if after and not re.match(r"^(?:see|if|do not|enter|please)\b", after, re.I):
                collected.append(after)
            start = idx + 1
            continue
        if start is not None:
            nxt = lines[idx].strip()
            if not nxt:
                continue
            if any(re.search(pat, nxt, flags=re.IGNORECASE) for pat in stop_res):
                break
            if re.match(r"^(?:see|if|do not|enter|please)\b", nxt, re.I):
                continue
            collected.append(nxt)
    if collected:
        return _clean(" ".join(collected))
    return None


def _extract_signature_date(text: str) -> Optional[str]:
    lines = text.splitlines()
    for i, line in enumerate(lines):
        if re.search(r"signature", line, flags=re.IGNORECASE):
            snippet = "\n".join(lines[i : i + 3])
            dt = _parse_date(snippet)
            if dt:
                return _clean(dt)
    return None


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
    tin = None
    if ein:
        digits = re.sub(r"\D", "", ein.group(0)).strip()
        tin = f"{digits[:2]}-{digits[2:]}"
    elif ssn:
        digits = re.sub(r"\D", "", ssn.group(0)).strip()
        tin = f"{digits[:3]}-{digits[3:5]}-{digits[5:]}"

    lines = text.splitlines()

    legal_name = _extract_labeled_field(
        lines,
        r"^\s*1\s*Name\s*(?:\(as shown on your income tax return\))?\s*[:\-]?",
        [r"^\s*2\b", r"^\s*Business name", r"^\s*\d+\b", ENTITY_TYPE_STOP_RE.pattern],
    )

    business_name = _extract_labeled_field(
        lines,
        r"^\s*2\s*Business name(?:/disregarded entity name, if different from above)?\s*[:\-]?",
        [r"^\s*3\b", r"^\s*Check", r"^\s*\d+\b", ENTITY_TYPE_STOP_RE.pattern],
    )

    entity_type = None
    et = ENTITY_TYPE_RE.search(text)
    if et:
        entity_type = _clean(et.group(0))

    address = None
    addr_lines: List[str] = []
    for i, line in enumerate(lines):
        if re.search(r"Address\s*\(number,\s*street", line, flags=re.IGNORECASE):
            if i + 1 < len(lines):
                addr_lines.append(lines[i + 1].strip())
        if re.search(r"City,\s*state,\s*and\s*ZIP", line, flags=re.IGNORECASE):
            if i + 1 < len(lines):
                addr_lines.append(lines[i + 1].strip())
    if addr_lines:
        address = _clean(" ".join(addr_lines))
    if not address:
        for line in lines:
            if re.search(r"\b[A-Z]{2}\s+\d{5}(-\d{4})?\b", line):
                address = _clean(line)
                break

    date_signed = _extract_signature_date(text)

    fields: Dict[str, Any] = {}
    if legal_name:
        fields["legal_name"] = _clean(legal_name)
    if business_name:
        fields["business_name"] = _clean(business_name)
    if entity_type:
        fields["entity_type"] = _clean(entity_type)
    if tin:
        fields["tin"] = _clean(tin)
    if address:
        fields["address"] = _clean(address)
    if date_signed:
        fields["date_signed"] = _clean(date_signed)

    conf = 0.6 + (0.1 if tin else 0) + (0.1 if legal_name else 0)

    return {
        "doc_type": "W9_Form",
        "confidence": min(conf, 0.95),
        "fields": fields,
        "evidence_key": evidence_key,
    }


__all__ = ["detect", "extract"]
