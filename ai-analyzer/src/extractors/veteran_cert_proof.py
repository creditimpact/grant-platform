"""Extractor for veteran certification proof documents (certificates & letters)."""

from __future__ import annotations

from datetime import UTC, datetime
import re
from typing import Any, Dict, List, Optional


def _make_field(value: Any = None, confidence: float = 0.0, source: Optional[str] = None) -> Dict[str, Any]:
    return {"value": value, "confidence": round(confidence, 2), "source": source}


def _normalize_date(value: str) -> Optional[str]:
    if not value:
        return None
    cleaned = value.strip().replace("\u2013", "-").replace("\u2014", "-")
    cleaned = re.sub(r"(st|nd|rd|th)", "", cleaned, flags=re.IGNORECASE)
    for fmt in ("%B %d %Y", "%B %d, %Y", "%b %d %Y", "%b %d, %Y", "%m/%d/%Y", "%m-%d-%Y", "%Y-%m-%d", "%m/%d/%y", "%m-%d-%y"):
        try:
            return datetime.strptime(cleaned, fmt).date().isoformat()
        except ValueError:
            continue
    match = re.search(r"(\d{1,2})/(\d{1,2})/(\d{2,4})", cleaned)
    if match:
        month, day, year = match.groups()
        if len(year) == 2:
            year = "20" + year if int(year) < 50 else "19" + year
        try:
            return datetime(int(year), int(month), int(day)).date().isoformat()
        except ValueError:
            return None
    return None


def _issuer_from_text(text: str) -> str:
    lowered = text.lower()
    if "small business administration" in lowered or "sba" in lowered:
        return "SBA"
    if "department of veterans affairs" in lowered or "va" in lowered:
        return "VA"
    return "STATE"


def _program_from_text(text: str) -> str:
    lowered = text.lower()
    if "vetcert" in lowered or "veteran small business certification" in lowered:
        return "VetCert"
    return "Legacy"


def _extract_naics(text: str) -> List[Dict[str, Any]]:
    fields: List[Dict[str, Any]] = []
    seen: set[str] = set()
    for line in text.splitlines():
        if "naics" not in line.lower():
            continue
        for code in re.findall(r"(\d{6})", line):
            if code not in seen:
                seen.add(code)
                fields.append(_make_field(code, 0.85, "NAICS"))
    return fields


def _status_from_dates(issue: Optional[str], valid: Optional[str], text: str) -> str:
    lowered = text.lower()
    today = datetime.now(UTC).date()
    if valid:
        try:
            valid_date = datetime.strptime(valid, "%Y-%m-%d").date()
            if valid_date < today:
                return "expired"
        except ValueError:
            pass
    if "pending" in lowered or "under review" in lowered:
        return "pending"
    if "revoked" in lowered or "inactive" in lowered:
        return "revoked"
    if issue:
        return "active"
    return "pending"


def _certified_type(text: str) -> str:
    lowered = text.lower()
    if "service-disabled" in lowered or "service disabled" in lowered or "sdvosb" in lowered:
        return "SDVOSB"
    return "VOSB"


def _detect_doc_type(text: str, hint: Optional[str]) -> str:
    if hint in {"VOSB_Certificate", "SDVOSB_Certificate", "VOSB_SDVOSB_Approval_Letter"}:
        return hint
    lowered = text.lower()
    if "approval letter" in lowered or "verification letter" in lowered or "under review" in lowered:
        return "VOSB_SDVOSB_Approval_Letter"
    if "service-disabled" in lowered or "sdvosb" in lowered:
        return "SDVOSB_Certificate"
    return "VOSB_Certificate"


def extract(text: str, doc_hint: Optional[str] = None) -> Dict[str, Any]:
    doc_type = _detect_doc_type(text, doc_hint)
    issuer = _issuer_from_text(text)
    program = _program_from_text(text)

    business_name_match = re.search(
        r"(?:certifies that|awards to|confirms that)\s+([A-Za-z0-9&',.\- ]+?)\s+(?:has\s+been|is)\b",
        text,
        re.IGNORECASE,
    )
    if not business_name_match:
        business_name_match = re.search(r"Re:\s*([A-Za-z0-9&',.\- ]+)", text, re.IGNORECASE)
    business_name = business_name_match.group(1).strip(" .-\n") if business_name_match else None

    certificate_id_match = re.search(r"Certificate\s*(?:ID|No\.?|Number)\s*[:#]?\s*([A-Z0-9-]+)", text, re.IGNORECASE)
    certificate_id = certificate_id_match.group(1).strip() if certificate_id_match else None

    issue_match = re.search(r"(?:issue date|issued on|certified on)\s*[:\-]?\s*([A-Za-z0-9 ,/\-]+)", text, re.IGNORECASE)
    valid_match = re.search(r"(?:valid through|expires on|expiration date)\s*[:\-]?\s*([A-Za-z0-9 ,/\-]+)", text, re.IGNORECASE)

    issue_date = _normalize_date(issue_match.group(1)) if issue_match else None
    valid_through = _normalize_date(valid_match.group(1)) if valid_match else None

    certified_as = _certified_type(text)
    status = _status_from_dates(issue_date, valid_through, text)

    naics = _extract_naics(text)

    proof_block = {
        "businessName": _make_field(business_name, 0.9 if business_name else 0.0, "Business Name" if business_name else None),
        "certificateId": _make_field(certificate_id, 0.8 if certificate_id else 0.0, "Certificate ID" if certificate_id else None),
        "certifiedAs": _make_field(certified_as, 0.85, "Certified As"),
        "issueDate": _make_field(issue_date, 0.8 if issue_date else 0.0, "Issue Date" if issue_date else None),
        "validThrough": _make_field(valid_through, 0.8 if valid_through else 0.0, "Valid Through" if valid_through else None),
        "status": _make_field(status, 0.85, "Derived Status"),
        "naics": naics,
    }

    fields_clean = {
        "veteranCert": {"doc": {"type": doc_type, "issuer": issuer, "program": program}, "proof": proof_block},
        "proof.type": doc_type,
        "proof.issuer": issuer,
        "proof.program": program,
        "proof.businessName": business_name,
        "proof.certificateId": certificate_id,
        "proof.certifiedAs": certified_as,
        "proof.issueDate": issue_date,
        "proof.validThrough": valid_through,
        "proof.status": status,
        "proof.naics": [entry["value"] for entry in naics if entry["value"]],
    }

    fields = {"veteranCert": {"doc": {"type": doc_type, "issuer": issuer, "program": program}, "proof": proof_block}}

    return {
        "doc_type": doc_type,
        "confidence": 0.93,
        "fields": fields,
        "fields_clean": fields_clean,
    }

