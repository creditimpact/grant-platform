import re
from datetime import datetime
from typing import Any, Dict, Optional

EIN_RE = re.compile(r"\b\d{2}[-\s]?\d{7}\b")
SSN_RE = re.compile(r"\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b")
DATE_PATS = [
    r"\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b",
    r"\b[A-Za-z]{3,9}\s+\d{1,2},\s+\d{4}\b",
]


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
                "%B %d, %Y",
                "%b %d, %Y",
            ):
                try:
                    return datetime.strptime(raw, fmt).date().isoformat()
                except Exception:
                    pass
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

    legal_name = None
    m_name = re.search(
        r"Name\s*\(as shown on your income tax return\)\s*[:\-]?\s*(.+)",
        text,
        flags=re.IGNORECASE,
    )
    if m_name:
        legal_name = m_name.group(1).strip()
    else:
        lines = text.splitlines()
        for i, line in enumerate(lines):
            if re.search(r"Name\s*\(as shown on your income tax return\)", line, flags=re.IGNORECASE):
                if i + 1 < len(lines):
                    nxt = lines[i + 1].strip()
                    if nxt:
                        legal_name = nxt
                break
        if not legal_name:
            m_name = re.search(
                r"(?:Name|Legal Name)\s*[:\-]\s*(.+)",
                text,
                flags=re.IGNORECASE,
            )
            if m_name:
                legal_name = m_name.group(1).strip()

    business_name = None
    m_biz = re.search(
        r"(?:Business\s+name.*?|DBA)\s*[:\-]?\s*(.+)",
        text,
        flags=re.IGNORECASE,
    )
    if m_biz:
        business_name = m_biz.group(1).strip()

    entity_type = None
    et = re.search(
        r"\b(LLC|Limited Liability Company|Corporation|C[ -]?Corp|S[ -]?Corp|Sole Propriet(?:or|orship)|Partnership|Nonprofit)\b",
        text,
        flags=re.IGNORECASE,
    )
    if et:
        entity_type = et.group(0)

    address = None
    lines = text.splitlines()
    addr_lines = []
    for i, line in enumerate(lines):
        if re.search(r"Address\s*\(number,\s*street", line, flags=re.IGNORECASE):
            if i + 1 < len(lines):
                addr_lines.append(lines[i + 1].strip())
        if re.search(r"City,\s*state,\s*and\s*ZIP", line, flags=re.IGNORECASE):
            if i + 1 < len(lines):
                addr_lines.append(lines[i + 1].strip())
    if addr_lines:
        address = " ".join(addr_lines)
    if not address:
        for line in lines:
            if re.search(r"\b[A-Z]{2}\s+\d{5}(-\d{4})?\b", line):
                address = line.strip()
                break

    date_signed = _parse_date(text)

    fields: Dict[str, Any] = {}
    if legal_name:
        fields["legal_name"] = legal_name
    if business_name:
        fields["business_name"] = business_name
    if entity_type:
        fields["entity_type"] = entity_type
    if tin:
        fields["tin"] = tin
    if address:
        fields["address"] = address
    if date_signed:
        fields["date_signed"] = date_signed

    conf = 0.6 + (0.1 if tin else 0) + (0.1 if legal_name else 0)

    return {
        "doc_type": "W9_Form",
        "confidence": min(conf, 0.95),
        "fields": fields,
        "evidence_key": evidence_key,
    }


__all__ = ["detect", "extract"]
