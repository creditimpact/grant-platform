import re
from datetime import datetime
from typing import Any, Dict, Optional

SECONDARY_SECTIONS = [
    "Executive Summary",
    "Market Analysis",
    "Financial Projections",
    "Funding Request",
]


def detect(text: str) -> bool:
    tl = text.lower()
    if "business plan" not in tl:
        return False
    return any(sec.lower() in tl for sec in SECONDARY_SECTIONS)


def _parse_business_name(text: str) -> Optional[str]:
    for line in text.splitlines():
        line_s = line.strip()
        if (
            line_s
            and line_s.isupper()
            and not any(ch.isdigit() for ch in line_s)
            and "BUSINESS PLAN" not in line_s
        ):
            return line_s
    return None


SENTENCE_RE = re.compile(r"[^.!?]+[.!?]")


def _extract_executive_summary(text: str) -> Optional[str]:
    m = re.search(r"Executive Summary\s*(.+)", text, re.IGNORECASE | re.DOTALL)
    if not m:
        return None
    after = m.group(1).strip()
    sentences = SENTENCE_RE.findall(after)
    if not sentences:
        return None
    return " ".join(sentences[:6]).strip()


AMOUNT_RE = re.compile(
    r"(funding request|grant amount|funding amount|use of funds)[^\d$]*(\$?[\d,]+)",
    re.IGNORECASE,
)


def _parse_amount(text: str) -> Optional[int]:
    m = AMOUNT_RE.search(text)
    if not m:
        return None
    raw = m.group(2).replace("$", "").replace(",", "")
    try:
        return int(raw)
    except ValueError:
        try:
            return int(float(raw))
        except ValueError:
            return None


PERIOD_RE = re.compile(r"(\d+)[-\s]?year (projection|forecast|plan)", re.IGNORECASE)


def _parse_period_years(text: str) -> Optional[int]:
    m = PERIOD_RE.search(text)
    if m:
        try:
            return int(m.group(1))
        except ValueError:
            return None
    return None


DATE_PATTERNS = [
    (re.compile(r"(\d{1,2}/\d{1,2}/\d{4})"), ["%m/%d/%Y"]),
    (
        re.compile(
            r"((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4})"
        ),
        ["%B %d, %Y"],
    ),
]


def _parse_last_updated(text: str) -> Optional[str]:
    lines = text.splitlines()[:20]
    for line in lines:
        for rx, fmts in DATE_PATTERNS:
            m = rx.search(line)
            if m:
                raw = m.group(1)
                for fmt in fmts:
                    try:
                        return datetime.strptime(raw, fmt).date().isoformat()
                    except Exception:
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

    business_name = _parse_business_name(text)
    executive_summary = _extract_executive_summary(text)
    amount = _parse_amount(text)
    period_years = _parse_period_years(text)
    last_updated = _parse_last_updated(text)

    fields: Dict[str, Any] = {}
    if business_name:
        fields["business_name"] = business_name
    if executive_summary:
        fields["executive_summary"] = executive_summary
    if amount is not None:
        fields["funding_request_amount"] = amount
    if period_years is not None:
        fields["period_years"] = period_years
    if last_updated:
        fields["last_updated"] = last_updated

    conf = 0.6
    if business_name:
        conf += 0.1
    if executive_summary:
        conf += 0.1
    if amount is not None:
        conf += 0.05
    if period_years is not None:
        conf += 0.05
    if last_updated:
        conf += 0.05

    return {
        "doc_type": "Business_Plan",
        "confidence": min(conf, 0.95),
        "fields": fields,
        "evidence_key": evidence_key,
    }


__all__ = ["detect", "extract"]

