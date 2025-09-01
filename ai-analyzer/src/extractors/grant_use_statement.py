import re
from datetime import datetime
from typing import Any, Dict, Optional

KEYWORDS = [
    "Use of Funds",
    "Grant Use Statement",
    "Intended Use of Grant Funds",
    "Statement of Intended Use",
]

AMOUNT_RE = re.compile(r"(?:Funding Request|Amount|Use of Funds)[:\s]*\$?([0-9,]+)", re.IGNORECASE)
DATE_RE = re.compile(r"\b(\d{4}-\d{2}-\d{2}|\d{1,2}/\d{1,2}/\d{2,4})\b")


def detect(text: str) -> bool:
    tl = text.lower()
    return any(k.lower() in tl for k in KEYWORDS)


def _parse_amount(text: str) -> Optional[float]:
    m = AMOUNT_RE.search(text)
    if m:
        val = m.group(1).replace(",", "")
        try:
            return float(val)
        except ValueError:
            return None
    return None


def _parse_categories(text: str) -> list[str]:
    cats = []
    for line in text.splitlines():
        line = line.strip()
        if re.match(r"[-\u2022]", line):
            item = re.sub(r"^[-\u2022]\s*", "", line)
            if item:
                cats.append(item.lower())
    return cats


def _parse_justification(text: str) -> Optional[str]:
    m = re.search(r"Justification[:\s]*(.+)", text, re.IGNORECASE)
    if m:
        return m.group(1).strip()
    return None


def _parse_date(text: str) -> Optional[str]:
    m = DATE_RE.search(text)
    if not m:
        return None
    raw = m.group(1)
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y"):
        try:
            return datetime.strptime(raw, fmt).date().isoformat()
        except ValueError:
            continue
    return None


def extract(text: str, evidence_key: Optional[str] = None) -> Dict[str, Any]:
    if not detect(text):
        return {
            "doc_type": None,
            "confidence": 0.0,
            "fields": {},
            "evidence_key": evidence_key,
        }
    fields: Dict[str, Any] = {}
    amt = _parse_amount(text)
    if amt is not None:
        fields["funding_request_amount"] = amt
    cats = _parse_categories(text)
    if cats:
        fields["intended_categories"] = cats
    just = _parse_justification(text)
    if just:
        fields["justification"] = just
    dt = _parse_date(text)
    if dt:
        fields["date_signed"] = dt
    conf = 0.6
    if "funding_request_amount" in fields:
        conf += 0.2
    if "intended_categories" in fields:
        conf += 0.1
    return {
        "doc_type": "Grant_Use_Statement",
        "confidence": min(conf, 0.95),
        "fields": fields,
        "evidence_key": evidence_key,
    }


__all__ = ["detect", "extract"]
