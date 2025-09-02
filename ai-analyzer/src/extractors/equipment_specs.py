import re
from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel

KEYWORDS = ["Specifications", "Datasheet", "Equipment", "Technical Data"]


def detect(text: str) -> bool:
    t = text.lower()
    return any(k.lower() in t for k in KEYWORDS)


class EquipmentSpecsFields(BaseModel):
    equipment_name: Optional[str] = None
    model_number: Optional[str] = None
    capacity_kw: Optional[float] = None
    efficiency_percent: Optional[float] = None
    certifications: list[str] = []
    manufacturer: Optional[str] = None
    issue_date: Optional[str] = None


def _norm_date(val: str) -> str:
    for fmt in ("%Y-%m-%d", "%B %d, %Y", "%b %d, %Y", "%m/%d/%Y"):
        try:
            return datetime.strptime(val.strip(), fmt).date().isoformat()
        except ValueError:
            continue
    return val.strip()


EQUIPMENT_NAME_RE = re.compile(r"(?:Equipment|Product)\s*:\s*([^\n]+)", re.I)
MODEL_RE = re.compile(r"(?:Model|Type)[:\s]+([\w\-]+)", re.I)
CAPACITY_RE = re.compile(r"(?:Capacity|Power Output|Rating)[:\s]*([0-9]+(?:\.[0-9]+)?)\s*kW", re.I)
EFFICIENCY_RE = re.compile(r"Efficiency[:\s]+([0-9]+(?:\.[0-9]+)?)\s*%", re.I)
EFFICIENCY_RE2 = re.compile(r"([0-9]+(?:\.[0-9]+)?)\s*%[^\n]*Efficiency", re.I)
CERT_RE = re.compile(r"(UL\s?\d{3,4}|IEC\s?\d{3,5}|EnergyStar)", re.I)
MANUFACTURER_RE = re.compile(r"Manufacturer\s*:\s*([^\n]+)", re.I)
ISSUE_DATE_RE = re.compile(r"(?:Date(?: Issued)?|Issued)\s*:\s*([A-Za-z0-9,\/-]{4,20})", re.I)


def extract(text: str, evidence_key: Optional[str] = None) -> Dict[str, Any]:
    if not detect(text):
        return {
            "doc_type": None,
            "confidence": 0.0,
            "fields": {},
            "evidence_key": evidence_key,
        }

    f = EquipmentSpecsFields()
    if m := EQUIPMENT_NAME_RE.search(text):
        f.equipment_name = m.group(1).strip()
    if m := MODEL_RE.search(text):
        f.model_number = m.group(1).strip()
    if m := CAPACITY_RE.search(text):
        f.capacity_kw = float(m.group(1))
    if m := EFFICIENCY_RE.search(text):
        f.efficiency_percent = float(m.group(1))
    elif m := EFFICIENCY_RE2.search(text):
        f.efficiency_percent = float(m.group(1))
    certs = [c.strip() for c in CERT_RE.findall(text)]
    if certs:
        f.certifications = certs
    if m := MANUFACTURER_RE.search(text):
        f.manufacturer = m.group(1).strip()
    if m := ISSUE_DATE_RE.search(text):
        f.issue_date = _norm_date(m.group(1))

    confidence = 0.55
    if f.model_number:
        confidence += 0.1
    if f.capacity_kw is not None:
        confidence += 0.1
    if f.efficiency_percent is not None:
        confidence += 0.1
    if f.equipment_name:
        confidence += 0.05
    if f.manufacturer:
        confidence += 0.05
    if f.certifications:
        confidence += 0.05
    if f.issue_date:
        confidence += 0.05

    return {
        "doc_type": "Equipment_Specs",
        "confidence": min(confidence, 0.99),
        "fields": f.model_dump(),
        "evidence_key": evidence_key,
    }


__all__ = ["detect", "extract"]
