from datetime import datetime
import re
from pydantic import BaseModel


def detect_business_license(text: str) -> bool:
    keywords = [
        "Application for General Business License",
        "Business License",
        "Applicant Information",
        "Business Information",
    ]
    t = text.lower()
    return any(k.lower() in t for k in keywords)


class BusinessLicenseFields(BaseModel):
    applicant_name: str | None = None
    date_of_birth: str | None = None
    home_address: str | None = None
    business_name: str | None = None
    business_address: str | None = None
    type_of_business: str | None = None


def _normalize_date(val: str) -> str:
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%m-%d-%Y"):
        try:
            return datetime.strptime(val, fmt).date().isoformat()
        except ValueError:
            continue
    return val


APPLICANT_NAME_RE = re.compile(r"Applicant Name\s*[:\-]?\s*(.+)", re.I)
DOB_RE = re.compile(r"Date of Birth\s*[:\-]?\s*([0-9/\-]+)", re.I)
HOME_ADDRESS_RE = re.compile(r"Home Address\s*[:\-]?\s*(.+)", re.I)
BUSINESS_NAME_RE = re.compile(r"Business Name\s*[:\-]?\s*(.+)", re.I)
BUSINESS_ADDRESS_RE = re.compile(r"Business Address\s*[:\-]?\s*(.+)", re.I)
TYPE_OF_BUSINESS_RE = re.compile(r"Type of Business\s*[:\-]?\s*(.+)", re.I)


def extract(text: str) -> dict:
    f = BusinessLicenseFields()
    if m := APPLICANT_NAME_RE.search(text):
        f.applicant_name = m.group(1).strip()
    if m := DOB_RE.search(text):
        f.date_of_birth = _normalize_date(m.group(1).strip())
    if m := HOME_ADDRESS_RE.search(text):
        f.home_address = m.group(1).strip()
    if m := BUSINESS_NAME_RE.search(text):
        f.business_name = m.group(1).strip()
    if m := BUSINESS_ADDRESS_RE.search(text):
        f.business_address = m.group(1).strip()
    if m := TYPE_OF_BUSINESS_RE.search(text):
        f.type_of_business = m.group(1).strip()
    return {"fields": f.model_dump(), "confidence": 0.6}
