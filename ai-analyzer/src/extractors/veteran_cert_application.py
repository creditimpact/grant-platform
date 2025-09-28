"""Parser for Veteran Small Business certification applications."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
import re
from typing import Any, Dict, List, Optional, Tuple

from ai_analyzer.nlp_parser import extract_ein, normalize_country, normalize_state


def _make_field(value: Any = None, confidence: float = 0.0, source: Optional[str] = None) -> Dict[str, Any]:
    return {"value": value, "confidence": round(confidence, 2), "source": source}


def _normalize_phone(value: str) -> Optional[str]:
    digits = re.sub(r"\D", "", value or "")
    if not digits:
        return None
    if digits.startswith("1") and len(digits) == 11:
        digits = digits[1:]
    if len(digits) == 10:
        return f"+1{digits}"
    if len(digits) > 10 and digits.startswith("01"):
        digits = digits[2:]
        if len(digits) == 10:
            return f"+1{digits}"
    if len(digits) >= 11 and digits.startswith("+"):
        return digits
    return f"+{digits}" if digits else None


def _normalize_date(value: str) -> Optional[str]:
    raw = value.strip()
    if not raw:
        return None
    cleaned = (
        raw.replace("\u2013", "-")
        .replace("\u2014", "-")
        .replace("st", "")
        .replace("nd", "")
        .replace("rd", "")
        .replace("th", "")
    )
    candidates = [cleaned]
    if " – " in cleaned:
        candidates.extend(part.strip() for part in cleaned.split(" – "))
    for candidate in candidates:
        for fmt in ("%m/%d/%Y", "%m-%d-%Y", "%B %d %Y", "%b %d %Y", "%Y-%m-%d", "%m/%d/%y", "%m-%d-%y"):
            try:
                return datetime.strptime(candidate, fmt).date().isoformat()
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


def _parse_currency_to_cents(value: str) -> Optional[int]:
    if not value:
        return None
    cleaned = value.strip().lower().replace(",", "").replace("$", "")
    cleaned = cleaned.replace("(", "-").replace(")", "")
    multiplier = 1
    if cleaned.endswith("m"):
        multiplier = 1_000_000
        cleaned = cleaned[:-1]
    elif cleaned.endswith("k"):
        multiplier = 1_000
        cleaned = cleaned[:-1]
    try:
        amount = float(cleaned)
    except ValueError:
        match = re.search(r"-?\d+(?:\.\d+)?", cleaned)
        if not match:
            return None
        amount = float(match.group())
    cents = int(round(amount * multiplier * 100))
    return cents


def _parse_percent(value: str) -> Optional[float]:
    if not value:
        return None
    cleaned = value.strip().lower().replace("%", "").replace(",", "")
    try:
        pct = float(cleaned)
        if pct <= 1:
            pct *= 100
        return pct
    except ValueError:
        match = re.search(r"\d+(?:\.\d+)?", cleaned)
        if not match:
            return None
        pct = float(match.group())
        if pct <= 1:
            pct *= 100
        return pct


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


def _extract_label(lines: List[str], label: str) -> Optional[str]:
    pattern = re.compile(rf"^{re.escape(label)}\s*[:\-]?\s*(.*)$", re.IGNORECASE)
    for line in lines:
        match = pattern.match(line.strip())
        if match:
            value = match.group(1).strip()
            if value:
                return value
    return None


def _extract_version(text: str) -> Optional[str]:
    match = re.search(r"(?:version|rev\.?|application)[^\n]*(20\d{2}|19\d{2})", text, re.IGNORECASE)
    if match:
        return match.group(0).strip()
    match = re.search(r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+20\d{2}", text)
    if match:
        return match.group(0)
    return None


def _collect_lines(text: str) -> List[str]:
    return [line.strip() for line in text.splitlines() if line.strip()]


def _extract_address(lines: List[str]) -> Dict[str, Dict[str, Any]]:
    street = _extract_label(lines, "Street Address") or _extract_label(lines, "Business Address")
    city = _extract_label(lines, "City")
    state = _extract_label(lines, "State")
    zip_code = _extract_label(lines, "Zip") or _extract_label(lines, "Postal Code")
    country = _extract_label(lines, "Country")
    return {
        "street": _make_field(street, 0.9 if street else 0.0, "Street Address" if street else None),
        "city": _make_field(city, 0.85 if city else 0.0, "City" if city else None),
        "state": _make_field(normalize_state(state) if state else None, 0.85 if state else 0.0, "State" if state else None),
        "zip": _make_field(zip_code, 0.8 if zip_code else 0.0, "Zip" if zip_code else None),
        "country": _make_field(normalize_country(country) if country else None, 0.6 if country else 0.0, "Country" if country else None),
    }


def _extract_naics(text: str) -> List[Dict[str, Any]]:
    matches = re.findall(r"\b(\d{2}\d{4})\b", text)
    seen: List[str] = []
    results: List[Dict[str, Any]] = []
    for code in matches:
        if len(code) == 6 and code not in seen:
            seen.append(code)
            results.append(_make_field(code, 0.85, "NAICS"))
    if not results:
        alt = re.search(r"NAICS[^\d]*(\d{5,6})", text, re.IGNORECASE)
        if alt:
            digits = alt.group(1)[:6]
            if len(digits) == 6:
                results.append(_make_field(digits, 0.75, "NAICS"))
    return results


def _detect_requested_type(text: str) -> Optional[str]:
    lowered = text.lower()
    if "sdvosb" in lowered or "service-disabled" in lowered:
        return "SDVOSB"
    if "vosb" in lowered or "veteran-owned" in lowered:
        return "VOSB"
    return None


@dataclass
class OwnerField:
    index: str
    name: Optional[str] = None
    pct: Optional[float] = None
    veteran: Optional[bool] = None
    sdv: Optional[bool] = None
    role: Optional[str] = None
    notes: Optional[str] = None
    acquired: Optional[str] = None
    cash: Optional[int] = None
    equipment: Optional[int] = None
    other: Optional[str] = None


def _extract_owners(lines: List[str]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    owners: Dict[str, OwnerField] = {}
    for line in lines:
        m = re.match(r"owner\s*(\d+)\s+name\s*[:\-]?\s*(.*)$", line, re.IGNORECASE)
        if m:
            idx = m.group(1)
            owners.setdefault(idx, OwnerField(index=idx)).name = m.group(2).strip()
            continue
        m = re.match(r"owner\s*(\d+)\s+ownership\s+percentage\s*[:\-]?\s*(.*)$", line, re.IGNORECASE)
        if m:
            idx = m.group(1)
            owners.setdefault(idx, OwnerField(index=idx)).pct = _parse_percent(m.group(2))
            continue
        m = re.match(r"owner\s*(\d+)\s+veteran\s+status\s*[:\-]?\s*(.*)$", line, re.IGNORECASE)
        if m:
            idx = m.group(1)
            value = m.group(2).strip().lower()
            owners.setdefault(idx, OwnerField(index=idx)).veteran = value.startswith("y")
            continue
        m = re.match(r"owner\s*(\d+)\s+service[-\s]*disabled\s*[:\-]?\s*(.*)$", line, re.IGNORECASE)
        if m:
            idx = m.group(1)
            value = m.group(2).strip().lower()
            owners.setdefault(idx, OwnerField(index=idx)).sdv = value.startswith("y")
            continue
        m = re.match(r"owner\s*(\d+)\s+role.*[:\-]?\s*(.*)$", line, re.IGNORECASE)
        if m:
            idx = m.group(1)
            owners.setdefault(idx, OwnerField(index=idx)).role = m.group(2).strip()
            continue
        m = re.match(r"owner\s*(\d+)\s+control\s+notes\s*[:\-]?\s*(.*)$", line, re.IGNORECASE)
        if m:
            idx = m.group(1)
            owners.setdefault(idx, OwnerField(index=idx)).notes = m.group(2).strip()
            continue
        m = re.match(r"owner\s*(\d+)\s+acquired\s+on\s*[:\-]?\s*(.*)$", line, re.IGNORECASE)
        if m:
            idx = m.group(1)
            owners.setdefault(idx, OwnerField(index=idx)).acquired = _normalize_date(m.group(2))
            continue
        m = re.match(r"owner\s*(\d+)\s+investment\s+cash\s*[:\-]?\s*(.*)$", line, re.IGNORECASE)
        if m:
            idx = m.group(1)
            owners.setdefault(idx, OwnerField(index=idx)).cash = _parse_currency_to_cents(m.group(2))
            continue
        m = re.match(r"owner\s*(\d+)\s+investment\s+equipment\s*[:\-]?\s*(.*)$", line, re.IGNORECASE)
        if m:
            idx = m.group(1)
            owners.setdefault(idx, OwnerField(index=idx)).equipment = _parse_currency_to_cents(m.group(2))
            continue
        m = re.match(r"owner\s*(\d+)\s+investment\s+other\s*[:\-]?\s*(.*)$", line, re.IGNORECASE)
        if m:
            idx = m.group(1)
            owners.setdefault(idx, OwnerField(index=idx)).other = m.group(2).strip()
            continue

    owner_fields: List[Dict[str, Any]] = []
    owner_simple: List[Dict[str, Any]] = []
    for idx in sorted(owners):
        data = owners[idx]
        owner_fields.append(
            {
                "fullName": _make_field(data.name, 0.9 if data.name else 0.0, f"Owner {idx} Name" if data.name else None),
                "ownershipPct": _make_field(data.pct, 0.9 if data.pct is not None else 0.0, f"Owner {idx} Ownership" if data.pct is not None else None),
                "isVeteran": _make_field(data.veteran, 0.8 if data.veteran is not None else 0.0, f"Owner {idx} Veteran" if data.veteran is not None else None),
                "isServiceDisabledVeteran": _make_field(data.sdv, 0.8 if data.sdv is not None else 0.0, f"Owner {idx} Service-Disabled" if data.sdv is not None else None),
                "roleTitle": _make_field(data.role, 0.7 if data.role else 0.0, f"Owner {idx} Role" if data.role else None),
                "controlNotes": _make_field(data.notes, 0.6 if data.notes else 0.0, f"Owner {idx} Control" if data.notes else None),
                "dateAcquired": _make_field(data.acquired, 0.7 if data.acquired else 0.0, f"Owner {idx} Acquired" if data.acquired else None),
                "investment": {
                    "cash": _make_field(data.cash, 0.7 if data.cash is not None else 0.0, f"Owner {idx} Investment Cash" if data.cash is not None else None),
                    "equipment": _make_field(data.equipment, 0.7 if data.equipment is not None else 0.0, f"Owner {idx} Investment Equipment" if data.equipment is not None else None),
                    "other": _make_field(data.other, 0.6 if data.other else 0.0, f"Owner {idx} Investment Other" if data.other else None),
                },
            }
        )
        owner_simple.append(
            {
                "name": data.name,
                "percent": data.pct,
                "isVeteran": data.veteran,
                "isSDV": data.sdv,
            }
        )
    return owner_fields, owner_simple


def _extract_loans(lines: List[str]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    loan_map: Dict[str, Dict[str, Any]] = {}
    for line in lines:
        m = re.match(r"loan\s*(\d+)\s+lender\s*[:\-]?\s*(.*)$", line, re.IGNORECASE)
        if m:
            loan_map.setdefault(m.group(1), {})["lender"] = m.group(2).strip()
            continue
        m = re.match(r"loan\s*(\d+)\s+purpose\s*[:\-]?\s*(.*)$", line, re.IGNORECASE)
        if m:
            loan_map.setdefault(m.group(1), {})["purpose"] = m.group(2).strip()
            continue
        m = re.match(r"loan\s*(\d+)\s+original\s+amount\s*[:\-]?\s*(.*)$", line, re.IGNORECASE)
        if m:
            loan_map.setdefault(m.group(1), {})["originalAmount"] = _parse_currency_to_cents(m.group(2))
            continue
        m = re.match(r"loan\s*(\d+)\s+current\s+balance\s*[:\-]?\s*(.*)$", line, re.IGNORECASE)
        if m:
            loan_map.setdefault(m.group(1), {})["currentBalance"] = _parse_currency_to_cents(m.group(2))
            continue

    loans_detail: List[Dict[str, Any]] = []
    loans_simple: List[Dict[str, Any]] = []
    for idx in sorted(loan_map):
        data = loan_map[idx]
        loans_detail.append(
            {
                "lender": _make_field(data.get("lender"), 0.8 if data.get("lender") else 0.0, f"Loan {idx} Lender" if data.get("lender") else None),
                "purpose": _make_field(data.get("purpose"), 0.7 if data.get("purpose") else 0.0, f"Loan {idx} Purpose" if data.get("purpose") else None),
                "originalAmount": _make_field(data.get("originalAmount"), 0.75 if data.get("originalAmount") is not None else 0.0, f"Loan {idx} Original Amount" if data.get("originalAmount") is not None else None),
                "currentBalance": _make_field(data.get("currentBalance"), 0.7 if data.get("currentBalance") is not None else 0.0, f"Loan {idx} Current Balance" if data.get("currentBalance") is not None else None),
            }
        )
        loans_simple.append(
            {
                "lender": data.get("lender"),
                "purpose": data.get("purpose"),
                "originalAmount": data.get("originalAmount"),
                "currentBalance": data.get("currentBalance"),
            }
        )
    return loans_detail, loans_simple


def extract(text: str, _: Optional[str] = None) -> Dict[str, Any]:
    lines = _collect_lines(text)

    doc_info = {
        "type": "VOSB_SDVOSB_Application",
        "issuer": _issuer_from_text(text),
        "program": _program_from_text(text),
        "version": _extract_version(text),
    }

    legal_name = _extract_label(lines, "Legal Business Name")
    dba = _extract_label(lines, "DBA") or _extract_label(lines, "Doing Business As")
    ein_value, _, _, _ = extract_ein(text)
    entity_type = _extract_label(lines, "Entity Type")
    inc_state = normalize_state(_extract_label(lines, "State of Incorporation") or "")
    established = _normalize_date(_extract_label(lines, "Date Established") or "")
    phone = _normalize_phone(_extract_label(lines, "Business Phone") or "")
    email = _extract_label(lines, "Business Email") or _extract_label(lines, "Email")
    website = _extract_label(lines, "Website")

    business_fields = {
        "legalName": _make_field(legal_name, 0.95 if legal_name else 0.0, "Legal Business Name" if legal_name else None),
        "dba": _make_field(dba, 0.85 if dba else 0.0, "DBA" if dba else None),
        "ein": _make_field(ein_value, 0.9 if ein_value else 0.0, "EIN" if ein_value else None),
        "entityType": _make_field(entity_type, 0.8 if entity_type else 0.0, "Entity Type" if entity_type else None),
        "stateOfIncorp": _make_field(inc_state, 0.8 if inc_state else 0.0, "State of Incorporation" if inc_state else None),
        "dateEstablished": _make_field(established, 0.75 if established else 0.0, "Date Established" if established else None),
        "address": _extract_address(lines),
        "phone": _make_field(phone, 0.8 if phone else 0.0, "Business Phone" if phone else None),
        "email": _make_field(email, 0.8 if email else 0.0, "Business Email" if email else None),
        "website": _make_field(website, 0.6 if website else 0.0, "Website" if website else None),
        "naics": _extract_naics(text),
    }

    owners_detail, owners_simple = _extract_owners(lines)

    branch = _extract_label(lines, "Branch of Service")
    discharge = _extract_label(lines, "Discharge Type")
    dd214 = _extract_label(lines, "DD-214 Included") or _extract_label(lines, "DD214 Provided")
    va_letter = _extract_label(lines, "VA Disability Letter Included") or _extract_label(lines, "VA Disability Rating Letter")
    disability_pct = _parse_percent(_extract_label(lines, "Disability Rating Percent") or "")

    veteran_block = {
        "branchOfService": _make_field(branch, 0.7 if branch else 0.0, "Branch of Service" if branch else None),
        "dischargeType": _make_field(discharge, 0.7 if discharge else 0.0, "Discharge Type" if discharge else None),
        "dd214Present": _make_field(dd214.lower().startswith("y") if dd214 else None, 0.8 if dd214 else 0.0, "DD-214 Included" if dd214 else None),
        "vaDisabilityLetterPresent": _make_field(va_letter.lower().startswith("y") if va_letter else None, 0.8 if va_letter else 0.0, "VA Disability Letter" if va_letter else None),
        "disabilityRatingPercent": _make_field(disability_pct, 0.75 if disability_pct is not None else 0.0, "Disability Rating Percent" if disability_pct is not None else None),
    }

    ctrl_signs = _extract_label(lines, "Control - Signs Checks")
    ctrl_hires = _extract_label(lines, "Control - Hires/Fires")
    ctrl_executes = _extract_label(lines, "Control - Executes Contracts")
    ctrl_purchases = _extract_label(lines, "Control - Major Purchases")
    control = {
        "signsChecks": _make_field((ctrl_signs or "").lower().startswith("y"), 0.75 if ctrl_signs else 0.0, "Control - Signs Checks" if ctrl_signs else None),
        "hiresFires": _make_field((ctrl_hires or "").lower().startswith("y"), 0.75 if ctrl_hires else 0.0, "Control - Hires/Fires" if ctrl_hires else None),
        "executesContracts": _make_field((ctrl_executes or "").lower().startswith("y"), 0.75 if ctrl_executes else 0.0, "Control - Executes Contracts" if ctrl_executes else None),
        "majorPurchases": _make_field((ctrl_purchases or "").lower().startswith("y"), 0.75 if ctrl_purchases else 0.0, "Control - Major Purchases" if ctrl_purchases else None),
    }

    bank_name = _extract_label(lines, "Bank Name")
    signer_present = _extract_label(lines, "Authorized Signer Attached")
    banking = {
        "bankName": _make_field(bank_name, 0.7 if bank_name else 0.0, "Bank Name" if bank_name else None),
        "authorizedSignerPresent": _make_field(signer_present.lower().startswith("y") if signer_present else None, 0.7 if signer_present else 0.0, "Authorized Signer Attached" if signer_present else None),
    }

    loans_detail, loans_simple = _extract_loans(lines)

    affidavit_present = _extract_label(lines, "Affidavit Present") or _extract_label(lines, "Affidavit Included")
    affidavit_signer = _extract_label(lines, "Affidavit Signer") or _extract_label(lines, "Affidavit Signer Name")
    affidavit_date = _normalize_date(_extract_label(lines, "Affidavit Date") or "")
    affidavit = {
        "present": _make_field(affidavit_present.lower().startswith("y") if affidavit_present else None, 0.75 if affidavit_present else 0.0, "Affidavit Present" if affidavit_present else None),
        "signerName": _make_field(affidavit_signer, 0.7 if affidavit_signer else 0.0, "Affidavit Signer" if affidavit_signer else None),
        "signDate": _make_field(affidavit_date, 0.7 if affidavit_date else 0.0, "Affidavit Date" if affidavit_date else None),
    }

    requested_type = _detect_requested_type(text)

    warnings: List[str] = []
    veteran_owner_pct = max((owner.get("percent") or 0 for owner in owners_simple if owner.get("isVeteran")), default=0)
    if veteran_owner_pct < 51:
        warnings.append("ownership_below_51")
    dd214_bool = veteran_block["dd214Present"]["value"]
    if dd214_bool is False or dd214_bool is None:
        warnings.append("missing_dd214")
    va_bool = veteran_block["vaDisabilityLetterPresent"]["value"]
    if requested_type == "SDVOSB" and not va_bool:
        warnings.append("missing_va_disability_letter")
    if not affidavit["present"]["value"]:
        warnings.append("missing_affidavit")
    if not (control["signsChecks"]["value"] and control["executesContracts"]["value"]):
        warnings.append("control_not_demonstrated")

    application_payload = {
        "doc": doc_info,
        "business": business_fields,
        "owners": owners_detail,
        "veteran": veteran_block,
        "control": control,
        "banking": banking,
        "loans": loans_detail,
        "affidavit": affidavit,
        "requestedType": _make_field(requested_type, 0.7 if requested_type else 0.0, "Requested Certification" if requested_type else None),
        "warnings": warnings,
    }

    fields_clean = {
        "veteranCert": {"application": application_payload},
        "business.legalName": legal_name,
        "business.dba": dba,
        "business.ein": ein_value,
        "business.entityType": entity_type,
        "business.stateOfIncorp": inc_state,
        "business.dateEstablished": established,
        "business.address.street": business_fields["address"]["street"]["value"],
        "business.address.city": business_fields["address"]["city"]["value"],
        "business.address.state": business_fields["address"]["state"]["value"],
        "business.address.zip": business_fields["address"]["zip"]["value"],
        "business.address.country": business_fields["address"]["country"]["value"],
        "business.phone": phone,
        "business.email": email,
        "business.website": website,
        "business.naics": [code["value"] for code in business_fields["naics"] if code["value"]],
        "owners": owners_simple,
        "veteran.dd214Present": dd214_bool,
        "veteran.vaDisabilityLetterPresent": va_bool,
        "veteran.disabilityRatingPercent": disability_pct,
        "control.signsChecks": control["signsChecks"]["value"],
        "control.executesContracts": control["executesContracts"]["value"],
        "control.hiresFires": control["hiresFires"]["value"],
        "control.majorPurchases": control["majorPurchases"]["value"],
        "banking.bankName": bank_name,
        "banking.authorizedSignerPresent": banking["authorizedSignerPresent"]["value"],
        "loans": loans_simple,
        "affidavit.present": affidavit["present"]["value"],
        "affidavit.signerName": affidavit["signerName"]["value"],
        "affidavit.signDate": affidavit["signDate"]["value"],
        "requestedType": requested_type,
        "veteranCert.application.warnings": warnings,
    }

    fields = {
        "veteranCert": {"application": application_payload},
    }

    return {
        "doc_type": "VOSB_SDVOSB_Application",
        "confidence": 0.92,
        "fields": fields,
        "fields_clean": fields_clean,
        "warnings": warnings,
    }

