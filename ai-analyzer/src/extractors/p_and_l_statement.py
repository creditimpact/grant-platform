import re
from datetime import datetime
from typing import Any, Dict, Optional

DATE_RANGE = re.compile(r"(?:For the|For)\s+(?:period|year|quarter)\s+(.*?)(?:-|to)\s+(.*)", re.IGNORECASE)
MONEY = r"[-+]?\$?\s?\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?"


def _parse_date(s: str) -> Optional[str]:
    for fmt in ("%b %d, %Y", "%B %d, %Y", "%m/%d/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(s.strip(), fmt).date().isoformat()
        except Exception:
            pass
    return None


def detect(text: str) -> bool:
    t = text.lower()
    return any(k in t for k in ["profit and loss", "p&l", "income statement", "statement of operations"])


def _find_amount(label: str, text: str) -> Optional[str]:
    pat = re.compile(rf"(?:{label}).*?({MONEY})", re.IGNORECASE)
    m = pat.search(text)
    return m.group(1).replace("$", "").replace(",", "").strip() if m else None


def extract(text: str, evidence_key: Optional[str] = None) -> Dict[str, Any]:
    if not detect(text):
        return {
            "doc_type": None,
            "confidence": 0.0,
            "fields": {},
            "evidence_key": evidence_key,
        }

    period_start = period_end = None
    m = DATE_RANGE.search(text)
    if m:
        period_start = _parse_date(m.group(1))
        period_end = _parse_date(m.group(2))

    fields: Dict[str, Any] = {}
    if period_start:
        fields["period_start"] = period_start
    if period_end:
        fields["period_end"] = period_end

    fields["total_revenue"] = _find_amount("total revenue|revenue|sales", text)
    fields["cogs"] = _find_amount("cost of goods sold|cogs", text)
    fields["gross_profit"] = _find_amount("gross profit", text)
    fields["total_expenses"] = _find_amount("total expenses", text)
    fields["net_income"] = _find_amount("net income|net profit|loss", text)

    for k in list(fields.keys()):
        v = fields[k]
        if isinstance(v, str):
            try:
                fields[k] = float(v.replace("$", "").replace(",", ""))
            except Exception:
                pass

    conf = 0.65
    if fields.get("net_income") is not None:
        conf += 0.05
    if fields.get("total_revenue") is not None:
        conf += 0.05

    return {
        "doc_type": "Profit_And_Loss_Statement",
        "confidence": min(conf, 0.95),
        "fields": fields,
        "evidence_key": evidence_key,
    }


__all__ = ["detect", "extract"]
