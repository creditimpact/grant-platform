import re
from datetime import datetime
from typing import Dict


def _parse_currency(val: str) -> float:
    return float(val.replace(",", ""))


def _parse_date(val: str) -> str:
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(val, fmt).date().isoformat()
        except ValueError:
            continue
    return val


def _classify(text: str) -> str:
    t = text.lower()
    if "irs" in t or "internal revenue service" in t:
        return "federal"
    if "department of revenue" in t:
        return "state"
    if "city of" in t:
        return "city"
    return "other"


def extract(text: str) -> Dict[str, object]:
    out: Dict[str, object] = {}
    m = re.search(
        r"Payment\s+Confirmation\s+(?:Number|No\.)[^A-Z0-9]{0,10}([A-Z0-9\-]{6,})",
        text,
        flags=re.I,
    )
    if m:
        out["confirmation_number"] = m.group(1)
    m = re.search(
        r"(?:Amount\s*of\s*Payment|Payment\s*amount)\s*\$?([0-9,]+(?:\.[0-9]{2})?)",
        text,
        flags=re.I,
    )
    if m:
        out["payment_amount"] = _parse_currency(m.group(1))
    m = re.search(
        r"(?:Payment|Submitted)[^\n]{0,40}?((?:\d{4}[-/]\d{1,2}[-/]\d{1,2})|(?:\d{1,2}[-/]\d{1,2}[-/]\d{4}))",
        text,
        flags=re.I,
    )
    if m:
        out["payment_date"] = _parse_date(m.group(1))
    out["payment_type"] = _classify(text)
    return out
