from datetime import datetime
import re
from pydantic import BaseModel

KEYWORDS = [
    "Electricity bill",
    "Utility bill",
    "kWh",
    "Billing period",
    "Service address",
    "Meter read",
]


def detect(text: str) -> bool:
    t = text.lower()
    return any(k.lower() in t for k in KEYWORDS)


class UtilityBillFields(BaseModel):
    utility_provider: str | None = None
    service_address: str | None = None
    billing_period_start: str | None = None
    billing_period_end: str | None = None
    total_kwh: float | None = None
    total_amount_due: float | None = None
    account_number: str | None = None
    statement_date: str | None = None


def _norm_date(val: str) -> str:
    for fmt in ("%b %d, %Y", "%B %d, %Y", "%m/%d/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(val.strip(), fmt).date().isoformat()
        except ValueError:
            continue
    return val.strip()


UTILITY_PROVIDER_RE = re.compile(r"^(?!.*bill)(.*(?:Energy|Electric|Power|Utilities)[^\n]*)", re.I | re.M)
SERVICE_ADDRESS_RE = re.compile(r"Service address[:\s]+(.+)", re.I)
BILLING_PERIOD_RE = re.compile(
    r"Billing period[:\s]+(.*?)(?:to|\-|\u2013|\u2014)(.*?)$", re.I | re.M
)
TOTAL_KWH_RE = re.compile(
    r"(?i)(?:total (?:electricity|usage).*?\(kWh\)|kWh total|Total Usage \(kWh\))[:\s]*([0-9,]+(?:\.\d+)?)"
)
TOTAL_AMOUNT_DUE_RE = re.compile(
    r"(?i)total amount (?:due|owed)[:\s\$]*([0-9,]+(?:\.\d{2})?)"
)
ACCOUNT_NUMBER_RE = re.compile(
    r"(?i)(?:account|customer) (?:no\.?|number)[:\s]+([\w-]+)"
)
STATEMENT_DATE_RE = re.compile(
    r"(?i)(?:bill (?:prepared|date)|statement date)[:\s]+([A-Za-z]{3,9} \d{1,2},? \d{4}|\d{1,2}/\d{1,2}/\d{2,4})"
)


def extract(text: str) -> dict:
    f = UtilityBillFields()
    if m := UTILITY_PROVIDER_RE.search(text):
        f.utility_provider = m.group(1).strip()
    if m := SERVICE_ADDRESS_RE.search(text):
        f.service_address = m.group(1).strip()
    if m := BILLING_PERIOD_RE.search(text):
        f.billing_period_start = _norm_date(m.group(1))
        f.billing_period_end = _norm_date(m.group(2))
    if m := TOTAL_KWH_RE.search(text):
        f.total_kwh = float(m.group(1).replace(",", ""))
    if m := TOTAL_AMOUNT_DUE_RE.search(text):
        f.total_amount_due = float(m.group(1).replace(",", ""))
    if m := ACCOUNT_NUMBER_RE.search(text):
        f.account_number = m.group(1).strip()
    if m := STATEMENT_DATE_RE.search(text):
        f.statement_date = _norm_date(m.group(1))

    confidence = 0.6
    if f.billing_period_start and f.billing_period_end:
        confidence += 0.1
    if f.total_kwh is not None:
        confidence += 0.1
    if f.total_amount_due is not None:
        confidence += 0.1

    return {"fields": f.model_dump(), "confidence": confidence}

