import re
from datetime import datetime
from typing import Any, Dict, Optional

EIN_RE = re.compile(r"\b\d{2}-\d{7}\b")
SSN_RE = re.compile(r"\b\d{3}-\d{2}-\d{4}\b")
DATE_PATS = [
    r"\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b",
    r"\b[A-Za-z]{3,9}\s+\d{1,2},\s+\d{4}\b",
]


def detect(text: str) -> bool:
    tl = text.lower()
    needles = [
        "form w-9",
        "request for taxpayer identification number and certification",
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
    tin = ein.group(0) if ein else (ssn.group(0) if ssn else None)

    legal_name = None
    m_name = re.search(r"(?:Name|Legal Name)\s*[:\-]\s*(.+)", text, flags=re.IGNORECASE)
    if m_name:
        legal_name = m_name.group(1).strip()

    business_name = None
    m_biz = re.search(r"(?:Business\s+name|DBA)\s*[:\-]\s*(.+)", text, flags=re.IGNORECASE)
    if m_biz:
        business_name = m_biz.group(1).strip()

    entity_type = None
    et = re.search(
        r"\b(LLC|Corporation|C[ -]?Corp|S[ -]?Corp|Sole Propriet(?:or|orship)|Partnership|Nonprofit)\b",
        text,
        flags=re.IGNORECASE,
    )
    if et:
        entity_type = et.group(0)

    address = None
    for line in text.splitlines():
        if re.search(r"\b[A-Z]{2}\s+\d{5}(-\d{4})?\b", line):
            address = line.strip()
            break

    signature_date = _parse_date(text)

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
    if signature_date:
        fields["signature_date"] = signature_date

    conf = 0.6 + (0.1 if tin else 0) + (0.1 if legal_name else 0)

    return {
        "doc_type": "W9_Form",
        "confidence": min(conf, 0.95),
        "fields": fields,
        "evidence_key": evidence_key,
    }


__all__ = ["detect", "extract"]
