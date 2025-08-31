import re
from datetime import datetime
from typing import Any, Dict, Optional


EIN_RE = re.compile(r"\b(\d{2}-\d{7})\b")
DATE_CANDIDATES = [
    r"\b(\d{1,2}-\d{1,2}-\d{4})\b",
    r"\b([A-Za-z]{3,9}\s+\d{1,2},\s+\d{4})\b",
]
NOTICE_RE = re.compile(r"\bCP\s*575\s*([A-Z])?", re.IGNORECASE)


def detect(text: str) -> bool:
    needles = [
        "CP 575",
        "Employer Identification Number",
        "Internal Revenue Service",
        "Department of the Treasury",
    ]
    tl = text.lower()
    return any(n.lower() in tl for n in needles)


def parse_issue_date(text: str) -> Optional[str]:
    for pat in DATE_CANDIDATES:
        m = re.search(pat, text)
        if m:
            raw = m.group(1)
            for fmt in ("%m-%d-%Y", "%B %d, %Y", "%b %d, %Y"):
                try:
                    return datetime.strptime(raw, fmt).date().isoformat()
                except Exception:
                    continue
    return None


def parse_business_name(text: str) -> Optional[str]:
    for line in text.splitlines():
        line_s = line.strip()
        if (
            len(line_s) > 2
            and line_s.isupper()
            and not any(
                tok in line_s
                for tok in [
                    "INTERNAL REVENUE SERVICE",
                    "DEPARTMENT",
                    "UNITED STATES",
                ]
            )
        ):
            if not re.search(r"\d{3,}", line_s):
                return line_s
    return None


def parse_address_block(text: str) -> Optional[str]:
    lines = [l.rstrip() for l in text.splitlines()]
    for i, l in enumerate(lines):
        if re.search(r"\b[A-Z]{2}\s+\d{5}(-\d{4})?\b", l):
            start = max(0, i - 2)
            block = "\n".join(lines[start : i + 1])
            return block
    return None


def extract(text: str, evidence_key: Optional[str] = None) -> Dict[str, Any]:
    if not detect(text):
        return {
            "doc_type": None,
            "confidence": 0.0,
            "fields": {},
            "evidence_key": evidence_key,
        }

    ein = None
    m = EIN_RE.search(text)
    if m:
        ein = m.group(1)

    issue_date = parse_issue_date(text)
    business_name = parse_business_name(text)
    address = parse_address_block(text)

    notice = None
    nm = NOTICE_RE.search(text)
    if nm:
        tail = nm.group(1) or ""
        notice = ("CP 575 " + tail).strip()

    fields: Dict[str, Any] = {}
    if ein:
        fields["ein"] = ein
    if business_name:
        fields["business_name"] = business_name
    if address:
        fields["address"] = address
    if issue_date:
        fields["issue_date"] = issue_date
    if notice:
        fields["notice_code"] = notice

    conf = 0.6 + (0.1 if ein else 0) + (0.1 if issue_date else 0)

    return {
        "doc_type": "EIN_Letter",
        "confidence": min(conf, 0.95),
        "fields": fields,
        "evidence_key": evidence_key,
    }


__all__ = ["detect", "extract"]

