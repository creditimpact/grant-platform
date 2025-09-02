from __future__ import annotations
from datetime import datetime
import re
from typing import List
from pydantic import BaseModel

KEYWORDS = [
    "Energy Savings Report",
    "Engineering Report",
    "Measurement and Verification",
    "M&V",
    "Baseline",
    "Post-Installation",
    "kWh Saved",
    "Payback",
    "NPV",
    "IRR",
    "ASHRAE",
    "IPMVP",
]


def detect(text: str) -> bool:
    t = text.lower()
    return any(k.lower() in t for k in KEYWORDS)


class EnergySavingsFields(BaseModel):
    report_date: str | None = None
    business_name: str | None = None
    site_address: str | None = None
    measure_type: str | None = None
    baseline_kwh_annual: float | None = None
    post_kwh_annual: float | None = None
    kwh_saved_annual: float | None = None
    demand_reduction_kw: float | None = None
    tariff_rate_usd_per_kwh: float | None = None
    annual_savings_usd: float | None = None
    capex_usd: float | None = None
    opex_usd: float | None = None
    payback_years: float | None = None
    npv_usd: float | None = None
    irr_percent: float | None = None
    standards_refs: List[str] = []
    prepared_by_name: str | None = None
    prepared_by_license: str | None = None


DATE_RE = re.compile(r"(?i)(?:report date|date)[:\s]+([\w\-/, ]{4,20})")
BUSINESS_RE = re.compile(r"(?i)(?:business|customer|site)[:\s]+(.+)")
ADDRESS_RE = re.compile(r"(?i)(?:site|facility) address[:\s]+(.+)")
MEASURE_RE = re.compile(
    r"(?i)(solar|hvac|lighting|heat pump|vfd|wind|battery|insulation)")
BASELINE_KWH_RE = re.compile(
    r"(?i)baseline[^\n]*?([0-9,]+)\s*kWh(?:[^\n]*annual)?"
)
POST_KWH_RE = re.compile(
    r"(?i)post[- ]?(?:install(?:ation)?)?[^\n]*?([0-9,]+)\s*kWh"
)
KWH_SAVED_RE = re.compile(r"(?i)kWh saved[^\n]*?([0-9,]+)")
DEMAND_RE = re.compile(
    r"(?i)(?:demand|peak) reduction[^\n]*?([0-9.,]+)\s*kW"
)
TARIFF_RE = re.compile(r"\$([0-9.]+)\s*/\s*kWh")
ANNUAL_SAVINGS_RE = re.compile(
    r"(?i)annual savings[^\n]*?\$([0-9,]+(?:\.[0-9]{2})?)"
)
CAPEX_RE = re.compile(r"(?i)(?:capex|capital cost)[^\n]*?\$([0-9,]+(?:\.[0-9]{2})?)")
OPEX_RE = re.compile(r"(?i)(?:opex|operating cost)[^\n]*?\$([0-9,]+(?:\.[0-9]{2})?)")
PAYBACK_RE = re.compile(r"(?i)payback[^\n]*?([0-9]+(?:\.[0-9]+)?)\s*(?:years|yrs)")
NPV_RE = re.compile(r"(?i)npv[^\n]*?\$([0-9,.-]+)")
IRR_RE = re.compile(r"(?i)irr[^\n]*?([0-9]+(?:\.[0-9]+)?)\s*%")
STANDARDS_RE = re.compile(r"(?i)\b(ASHRAE\s?\d{1,3}\.\d|IPMVP(?: Option [A-D])?)\b")
PREPARED_NAME_RE = re.compile(
    r"(?i)prepared by[:\s]+(.+?)(?:,|\n)")
PREPARED_LICENSE_RE = re.compile(r"(?i)(?:license|pe)[:#\s]+([A-Za-z0-9#-]+)")


def _to_number(val: str) -> float:
    return float(val.replace(",", ""))


def _norm_date(val: str) -> str:
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%B %d, %Y", "%b %d, %Y"):
        try:
            return datetime.strptime(val.strip(), fmt).date().isoformat()
        except ValueError:
            continue
    return val.strip()


def extract(text: str) -> dict:
    f = EnergySavingsFields()
    if m := DATE_RE.search(text):
        f.report_date = _norm_date(m.group(1))
    if m := BUSINESS_RE.search(text):
        f.business_name = m.group(1).strip()
    if m := ADDRESS_RE.search(text):
        f.site_address = m.group(1).strip()
    if m := MEASURE_RE.search(text):
        f.measure_type = m.group(1).title()
    if m := BASELINE_KWH_RE.search(text):
        f.baseline_kwh_annual = _to_number(m.group(1))
    if m := POST_KWH_RE.search(text):
        f.post_kwh_annual = _to_number(m.group(1))
    if m := KWH_SAVED_RE.search(text):
        f.kwh_saved_annual = _to_number(m.group(1))
    if f.baseline_kwh_annual and f.post_kwh_annual and f.kwh_saved_annual is None:
        f.kwh_saved_annual = f.baseline_kwh_annual - f.post_kwh_annual
    if m := DEMAND_RE.search(text):
        f.demand_reduction_kw = _to_number(m.group(1))
    if m := TARIFF_RE.search(text):
        f.tariff_rate_usd_per_kwh = float(m.group(1))
    if m := ANNUAL_SAVINGS_RE.search(text):
        f.annual_savings_usd = _to_number(m.group(1))
    if m := CAPEX_RE.search(text):
        f.capex_usd = _to_number(m.group(1))
    if m := OPEX_RE.search(text):
        f.opex_usd = _to_number(m.group(1))
    if m := PAYBACK_RE.search(text):
        f.payback_years = float(m.group(1))
    if m := NPV_RE.search(text):
        f.npv_usd = _to_number(m.group(1))
    if m := IRR_RE.search(text):
        f.irr_percent = float(m.group(1))
    f.standards_refs = [m.group(1).strip() for m in STANDARDS_RE.finditer(text)]
    if m := PREPARED_NAME_RE.search(text):
        f.prepared_by_name = m.group(1).strip()
    if m := PREPARED_LICENSE_RE.search(text):
        f.prepared_by_license = m.group(1).strip()

    confidence = 0.6
    if f.baseline_kwh_annual is not None and f.post_kwh_annual is not None:
        confidence += 0.15
    if f.kwh_saved_annual is not None:
        confidence += 0.1
    if any([f.payback_years, f.npv_usd, f.irr_percent]):
        confidence += 0.1
    if f.standards_refs:
        confidence += 0.05
    if confidence > 0.95:
        confidence = 0.95

    return {"fields": f.model_dump(), "confidence": confidence}

