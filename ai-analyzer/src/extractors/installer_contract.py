import re
from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel


KEYWORDS = [
    "Installation Contract",
    "Installer Agreement",
    "Supply, Delivery and Installation",
    "Solar Installation",
    "HVAC INSTALLATION CONTRACT",
    "Installation Agreement",
]


def detect(text: str) -> bool:
    t = text.lower()
    return any(k.lower() in t for k in KEYWORDS)


class InstallerContractFields(BaseModel):
    provider_name: Optional[str] = None
    client_name: Optional[str] = None
    service_description: Optional[str] = None
    contract_start_date: Optional[str] = None
    contract_end_date: Optional[str] = None
    total_amount: Optional[float] = None
    contract_number: Optional[str] = None
    signature_dates: list[str] = []


def _norm_date(val: str) -> str:
    for fmt in ("%Y-%m-%d", "%B %d, %Y", "%b %d, %Y", "%m/%d/%Y", "%m-%d-%Y"):
        try:
            return datetime.strptime(val.strip(), fmt).date().isoformat()
        except ValueError:
            continue
    return val.strip()


PROVIDER_RE = re.compile(r"(?:Provider|Contractor|Installer)[:\s]+(.+)", re.I)
CLIENT_RE = re.compile(r"(?:Client|Customer)[:\s]+(.+)", re.I)
SERVICE_RE = re.compile(r"(?:Scope of Work|Services?|The Service)[:\s]*([^\n]+)", re.I)
START_DATE_RE = re.compile(r"(?:Start Date|Commence on|Effective Date)[:\s]+([^\n]+)", re.I)
END_DATE_RE = re.compile(r"(?:End Date|terminate on)[:\s]+([^\n]+)", re.I)
TOTAL_AMOUNT_RE = re.compile(r"(?:Payment Amount|Contract Value|Total|Compensation)[:\s\$]*([0-9,]+(?:\.\d{2})?)", re.I)
CONTRACT_NUM_RE = re.compile(r"(?:Contract|Agreement) (?:No\.|Number)[:\s]+([\w\-\/]+)", re.I)
SIGNATURE_DATE_RE = re.compile(r"Signature.*?(\d{4}-\d{2}-\d{2}|\d{1,2}/\d{1,2}/\d{2,4})", re.I)


def extract(text: str, evidence_key: Optional[str] = None) -> Dict[str, Any]:
    if not detect(text):
        return {
            "doc_type": None,
            "confidence": 0.0,
            "fields": {},
            "evidence_key": evidence_key,
        }

    f = InstallerContractFields()
    if m := PROVIDER_RE.search(text):
        f.provider_name = m.group(1).strip()
    if m := CLIENT_RE.search(text):
        f.client_name = m.group(1).strip()
    if m := SERVICE_RE.search(text):
        f.service_description = m.group(1).strip()
    if m := START_DATE_RE.search(text):
        f.contract_start_date = _norm_date(m.group(1))
    if m := END_DATE_RE.search(text):
        f.contract_end_date = _norm_date(m.group(1))
    if m := TOTAL_AMOUNT_RE.search(text):
        f.total_amount = float(m.group(1).replace(",", ""))
    if m := CONTRACT_NUM_RE.search(text):
        f.contract_number = m.group(1).strip()
    f.signature_dates = [
        _norm_date(d)
        for d in SIGNATURE_DATE_RE.findall(text)
    ]

    confidence = 0.65
    if f.provider_name and f.client_name:
        confidence += 0.1
    if f.total_amount is not None:
        confidence += 0.1
    if f.contract_start_date or f.contract_end_date:
        confidence += 0.05
    if f.signature_dates:
        confidence += 0.05

    return {
        "doc_type": "Installer_Contract",
        "confidence": min(confidence, 0.99),
        "fields": f.model_dump(),
        "evidence_key": evidence_key,
    }


__all__ = ["detect", "extract"]
