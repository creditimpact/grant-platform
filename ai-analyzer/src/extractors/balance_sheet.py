import re
from datetime import datetime
from typing import Any, Dict, Optional

MONEY = r"[-+]?\$?\s?\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?"


def detect(text: str) -> bool:
    t = text.lower()
    return ("balance sheet" in t) or ("statement of financial position" in t)


def _parse_date(text: str) -> Optional[str]:
    m = re.search(
        r"(?:as of|as at)\s+([A-Za-z]{3,9}\s+\d{1,2},\s+\d{4}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2})",
        text,
        re.IGNORECASE,
    )
    if m:
        raw = m.group(1)
        for fmt in ("%B %d, %Y", "%b %d, %Y", "%m/%d/%Y", "%m-%d-%Y", "%Y-%m-%d"):
            try:
                return datetime.strptime(raw, fmt).date().isoformat()
            except Exception:
                pass
    return None


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

    fields: Dict[str, Any] = {}
    as_of = _parse_date(text)
    if as_of:
        fields["as_of_date"] = as_of

    fields["total_assets"] = _find_amount("total assets", text)
    fields["total_liabilities"] = _find_amount("total liabilities", text)
    fields["total_equity"] = _find_amount("total equity|shareholders'? equity|members'? equity", text)

    for k in ["total_assets", "total_liabilities", "total_equity"]:
        v = fields.get(k)
        if isinstance(v, str):
            try:
                fields[k] = float(v.replace("$", "").replace(",", ""))
            except Exception:
                pass

    conf = 0.65
    if fields.get("total_assets") is not None:
        conf += 0.05
    if fields.get("total_equity") is not None:
        conf += 0.05

    return {
        "doc_type": "Balance_Sheet",
        "confidence": min(conf, 0.95),
        "fields": fields,
        "evidence_key": evidence_key,
    }


__all__ = ["detect", "extract"]
