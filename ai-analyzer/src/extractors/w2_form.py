from __future__ import annotations

import logging
import re
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

FORM_TITLE_RE = re.compile(r"Form\s+W-2\s+Wage\s+and\s+Tax\s+Statement", re.IGNORECASE)
OMB_RE = re.compile(r"OMB\s+No\.?\s*1545-0029", re.IGNORECASE)
COPY_RE = re.compile(r"Copy\s+(?:A|B|C|D|1|2)\b", re.IGNORECASE)
BOX_HEADER_RE = re.compile(r"^\s*(?:1|2|3|4|5|6|7|8|10|11|12|13|14|15|16|17|18|19|20)\b", re.IGNORECASE | re.MULTILINE)

EIN_RE = re.compile(r"Employer\s+identification\s+number\s*(?:\(EIN\))?\s*[:#-]?\s*([0-9][0-9\-\s]{8,})", re.IGNORECASE)
SSN_RE = re.compile(r"Employee'?s\s+social\s+security\s+number\s*[:#-]?\s*([0-9][0-9\-\s]{8,})", re.IGNORECASE)

BOX_NUMBER_TO_KEY: Dict[int, str] = {
    1: "box1_wages",
    2: "box2_federal_income_tax_withheld",
    3: "box3_social_security_wages",
    4: "box4_social_security_tax_withheld",
    5: "box5_medicare_wages_and_tips",
    6: "box6_medicare_tax_withheld",
    7: "box7_social_security_tips",
    8: "box8_allocated_tips",
    10: "box10_dependent_care_benefits",
    11: "box11_nonqualified_plans",
    16: "box16_state_wages",
    17: "box17_state_income_tax",
    18: "box18_local_wages",
    19: "box19_local_income_tax",
}

FIELD_BOX_MAP: Dict[str, str] = {
    "ein": "b",
    "employer_name": "c",
    "employer_address": "c",
    "employer_zip": "c",
    "employee_ssn": "a",
    "employee_ssn_masked": "a",
    "employee_name": "e",
    "employee_address": "f",
    "employee_zip": "f",
    "box12": "12",
    "box13_statutory_employee": "13",
    "box13_retirement_plan": "13",
    "box13_third_party_sick_pay": "13",
    "box14_other": "14",
    "box15_state": "15",
    "box15_employer_state_id": "15",
    "box16_state_wages": "16",
    "box17_state_income_tax": "17",
    "box18_local_wages": "18",
    "box19_local_income_tax": "19",
    "box20_locality_name": "20",
}
FIELD_BOX_MAP.update({key: str(num) for num, key in BOX_NUMBER_TO_KEY.items()})

BOX_LINE_RE = re.compile(r"^(?P<num>\d{1,2})(?P<suffix>[a-d]?)\s+(?P<body>.+)$", re.IGNORECASE)
BOX12_RE = re.compile(r"12([a-d])\s+([A-Z0-9]{1,3})\s+([$0-9,\.]+)", re.IGNORECASE)
CHECK_TRUE_RE = re.compile(r"(☑|☒|✅|✔|\[\s*[xX]\s*\]|\(\s*[xX]\s*\)|\b[Xx]\b)")
CHECK_FALSE_RE = re.compile(r"(☐|\[\s*\])")
STATE_LINE_RE = re.compile(
    r"15\s+State\s+([A-Z]{2})[^\n]*?state\s+ID\s+number\s+([A-Za-z0-9\-]+)",
    re.IGNORECASE | re.DOTALL,
)
LOCALITY_RE = re.compile(r"20\s+Locality\s+name\s+([A-Za-z0-9 \-]+)", re.IGNORECASE)
BOX14_LINE_RE = re.compile(r"^\s*14\s+Other\s+(.*)$", re.IGNORECASE)


def detect(text: str) -> bool:
    """Heuristic detection for IRS Form W-2 uploads."""
    if not text:
        return False
    score = 0
    if FORM_TITLE_RE.search(text):
        score += 1
    if OMB_RE.search(text):
        score += 1
    if COPY_RE.search(text):
        score += 1
    if len(BOX_HEADER_RE.findall(text)) >= 4:
        score += 1
    return score >= 2


def _digits(value: str) -> str:
    return re.sub(r"\D", "", value or "")


def _parse_money(token: str) -> Optional[float]:
    cleaned = (token or "").strip()
    if not cleaned:
        return None
    cleaned = cleaned.replace("$", "").replace(",", "")
    cleaned = cleaned.replace("O", "0").replace("o", "0")
    cleaned = re.sub(r"[^0-9.\-]", "", cleaned)
    if cleaned in {"", "-", "--", "."}:
        return None
    try:
        return float(Decimal(cleaned))
    except (InvalidOperation, ValueError):
        return None


def _mask_ssn(digits: str) -> Optional[str]:
    if len(digits) == 9:
        return f"***-**-{digits[-4:]}"
    return None


def _collect_block(lines: List[str], pattern: re.Pattern[str], max_lines: int = 4) -> List[str]:
    for idx, line in enumerate(lines):
        if pattern.search(line):
            collected: List[str] = []
            for offset in range(1, max_lines + 1):
                if idx + offset >= len(lines):
                    break
                candidate = lines[idx + offset].strip()
                if not candidate:
                    if collected:
                        break
                    continue
                if BOX_LINE_RE.match(candidate) or candidate.lower().startswith("copy"):
                    break
                collected.append(candidate)
            return collected
    return []


def _extract_box_value(text: str, box_number: int) -> Tuple[Optional[str], Optional[float]]:
    pattern = re.compile(
        rf"(?im)^\s*{box_number}(?!\d)[^\n]*?([\$0-9,\.]+)\s*$"
    )
    match = pattern.search(text)
    if match:
        raw = match.group(1).strip()
        return raw, _parse_money(raw)
    # fallback: capture last numeric token on the line
    pattern_fallback = re.compile(rf"(?im)^\s*{box_number}(?!\d)[^\n]*?([\$0-9,\.]+)")
    match = pattern_fallback.search(text)
    if match:
        raw = match.group(1).strip()
        return raw, _parse_money(raw)
    return None, None


def _parse_box14(line: str) -> Optional[Dict[str, Any]]:
    match = BOX14_LINE_RE.match(line)
    if not match:
        return None
    payload = match.group(1).strip()
    if not payload:
        return None
    parts = payload.split()
    amount = None
    split_index: Optional[int] = None
    for idx in range(len(parts) - 1, -1, -1):
        token = parts[idx]
        val = _parse_money(token)
        if val is not None:
            amount = val
            split_index = idx
            break
    label_tokens = parts
    if split_index is not None:
        label_tokens = parts[:split_index]
    label = " ".join(label_tokens).strip(" :")
    result: Dict[str, Any] = {"label": label or "Other"}
    if amount is not None:
        result["amount"] = amount
    return result


def _checkbox_value(text: str, label: str) -> Optional[bool]:
    pattern = re.compile(rf"{label}[^\n]*", re.IGNORECASE)
    match = pattern.search(text)
    if not match:
        return None
    snippet = match.group(0)
    marker_match = re.search(
        r"(☑|☒|✅|✔|\[\s*[xX]\s*\]|\(\s*[xX]\s*\)|\b[Xx]\b|☐|\[\s*\])",
        snippet,
    )
    if marker_match:
        marker = marker_match.group(0)
        if CHECK_TRUE_RE.search(marker):
            return True
        if CHECK_FALSE_RE.search(marker):
            return False
    # textual cues
    lowered = snippet.lower()
    if "yes" in lowered:
        return True
    if "no" in lowered:
        return False
    return None


def extract(text: str, evidence_key: Optional[str] = None) -> Dict[str, Any]:
    if not detect(text):
        return {
            "doc_type": None,
            "confidence": 0.0,
            "fields": {},
            "fields_clean": {},
            "warnings": ["Document did not match W-2 heuristics"],
            "evidence_key": evidence_key,
        }

    lines = text.splitlines()
    fields: Dict[str, Any] = {}
    fields_clean: Dict[str, Any] = {}
    field_confidence: Dict[str, float] = {}
    field_sources: Dict[str, Dict[str, Any]] = {}
    warnings: List[str] = []

    ein_raw = None
    if m := EIN_RE.search(text):
        ein_raw = m.group(1).strip()
        fields["ein"] = ein_raw
        digits = _digits(ein_raw)
        if len(digits) == 9:
            fields_clean["ein"] = digits
            field_confidence["ein"] = 0.95
        else:
            warnings.append("Employer EIN appears malformed")
    else:
        warnings.append("Missing employer EIN (box b)")

    if "ein" in fields:
        field_sources["ein"] = {"page": 1, "box": FIELD_BOX_MAP.get("ein", "b")}

    employer_block = _collect_block(
        lines, re.compile(r"Employer'?s\s+name,\s+address", re.IGNORECASE)
    )
    if employer_block:
        fields["employer_name"] = employer_block[0]
        fields_clean["employer_name"] = employer_block[0]
        address_lines = employer_block[1:] if len(employer_block) > 1 else []
        if address_lines:
            address = ", ".join(address_lines)
            fields["employer_address"] = address
            fields_clean["employer_address"] = address
            zip_match = re.search(r"\b\d{5}(?:-\d{4})?\b", address)
            if zip_match:
                zip_val = zip_match.group(0)
                fields["employer_zip"] = zip_val
                fields_clean["employer_zip"] = zip_val
        field_confidence["employer_name"] = 0.85
        if "employer_address" in fields_clean:
            field_confidence["employer_address"] = 0.75
        field_sources["employer_name"] = {"page": 1, "box": FIELD_BOX_MAP.get("employer_name", "c")}
        if "employer_address" in fields_clean:
            field_sources["employer_address"] = {
                "page": 1,
                "box": FIELD_BOX_MAP.get("employer_address", "c"),
            }
        if "employer_zip" in fields_clean:
            field_confidence["employer_zip"] = 0.7
            field_sources["employer_zip"] = {
                "page": 1,
                "box": FIELD_BOX_MAP.get("employer_zip", "c"),
            }
    else:
        warnings.append("Missing employer name/address block (box c)")

    if m := SSN_RE.search(text):
        ssn_raw = m.group(1).strip()
        fields["employee_ssn"] = ssn_raw
        digits = _digits(ssn_raw)
        if len(digits) == 9:
            fields_clean["employee_ssn"] = digits
            masked = _mask_ssn(digits)
            if masked:
                fields_clean["employee_ssn_masked"] = masked
            field_confidence["employee_ssn"] = 0.95
            field_sources["employee_ssn"] = {"page": 1, "box": FIELD_BOX_MAP.get("employee_ssn", "a")}
            field_sources["employee_ssn_masked"] = field_sources["employee_ssn"]
        else:
            warnings.append("Employee SSN appears malformed (box a)")
    else:
        warnings.append("Missing employee SSN (box a)")

    employee_name_block = _collect_block(lines, re.compile(r"Employee'?s\s+name", re.IGNORECASE))
    if employee_name_block:
        fields["employee_name"] = employee_name_block[0]
        fields_clean["employee_name"] = employee_name_block[0]
        field_confidence["employee_name"] = 0.85
        field_sources["employee_name"] = {"page": 1, "box": FIELD_BOX_MAP.get("employee_name", "e")}
    else:
        warnings.append("Missing employee name (box e)")

    employee_address_block = _collect_block(
        lines, re.compile(r"Employee'?s\s+address", re.IGNORECASE)
    )
    if employee_address_block:
        address = ", ".join(employee_address_block)
        fields["employee_address"] = address
        fields_clean["employee_address"] = address
        zip_match = re.search(r"\b\d{5}(?:-\d{4})?\b", address)
        if zip_match:
            zip_val = zip_match.group(0)
            fields["employee_zip"] = zip_val
            fields_clean["employee_zip"] = zip_val
        field_confidence["employee_address"] = 0.75
        field_sources["employee_address"] = {
            "page": 1,
            "box": FIELD_BOX_MAP.get("employee_address", "f"),
        }
        if "employee_zip" in fields_clean:
            field_confidence["employee_zip"] = 0.7
            field_sources["employee_zip"] = {
                "page": 1,
                "box": FIELD_BOX_MAP.get("employee_zip", "f"),
            }
    else:
        warnings.append("Missing employee address (box f)")

    # Box 12 codes
    box12_matches = BOX12_RE.findall(text)
    if box12_matches:
        entries = []
        for suffix, code, amount_raw in box12_matches:
            amount = _parse_money(amount_raw)
            entry: Dict[str, Any] = {"box": suffix.lower(), "code": code.upper()}
            if amount is not None:
                entry["amount"] = amount
            entries.append(entry)
        fields["box12"] = entries
        fields_clean["box12"] = [
            {k: v for k, v in entry.items() if k != "box"} for entry in entries
        ]
        field_confidence["box12"] = 0.8
        field_sources["box12"] = {"page": 1, "box": FIELD_BOX_MAP.get("box12", "12")}

    # Numeric boxes
    for box_number, key in BOX_NUMBER_TO_KEY.items():
        raw, normalized = _extract_box_value(text, box_number)
        if raw is None and normalized is None:
            continue
        if raw is not None:
            fields[key] = raw
        if normalized is not None:
            fields_clean[key] = normalized
            field_confidence[key] = 0.8
            field_sources[key] = {"page": 1, "box": FIELD_BOX_MAP.get(key, str(box_number))}
        else:
            warnings.append(f"Box {box_number} value appears malformed")

    # Box 13 checkboxes
    stat_emp = _checkbox_value(text, "Statutory employee")
    if stat_emp is not None:
        fields_clean["box13_statutory_employee"] = stat_emp
        field_confidence["box13_statutory_employee"] = 0.7
        field_sources["box13_statutory_employee"] = {
            "page": 1,
            "box": FIELD_BOX_MAP.get("box13_statutory_employee", "13"),
        }
    retire_plan = _checkbox_value(text, "Retirement plan")
    if retire_plan is not None:
        fields_clean["box13_retirement_plan"] = retire_plan
        field_confidence["box13_retirement_plan"] = 0.7
        field_sources["box13_retirement_plan"] = {
            "page": 1,
            "box": FIELD_BOX_MAP.get("box13_retirement_plan", "13"),
        }
    sick_pay = _checkbox_value(text, "Third-party sick pay")
    if sick_pay is not None:
        fields_clean["box13_third_party_sick_pay"] = sick_pay
        field_confidence["box13_third_party_sick_pay"] = 0.7
        field_sources["box13_third_party_sick_pay"] = {
            "page": 1,
            "box": FIELD_BOX_MAP.get("box13_third_party_sick_pay", "13"),
        }

    # Box 14 other
    box14_entries: List[Dict[str, Any]] = []
    for line in lines:
        parsed = _parse_box14(line)
        if parsed:
            box14_entries.append(parsed)
    if box14_entries:
        fields["box14_other"] = box14_entries
        fields_clean["box14_other"] = box14_entries
        field_confidence["box14_other"] = 0.7
        field_sources["box14_other"] = {"page": 1, "box": FIELD_BOX_MAP.get("box14_other", "14")}

    # State and locality (boxes 15-20)
    if m := STATE_LINE_RE.search(text):
        state_abbrev, employer_state_id = m.groups()
        state_abbrev = state_abbrev.upper()
        employer_state_id = employer_state_id.strip()
        fields["box15_state"] = state_abbrev
        fields["box15_employer_state_id"] = employer_state_id
        fields_clean["box15_state"] = state_abbrev
        fields_clean["box15_employer_state_id"] = employer_state_id
        field_confidence["box15_state"] = 0.75
        field_confidence["box15_employer_state_id"] = 0.75
        field_sources["box15_state"] = {"page": 1, "box": FIELD_BOX_MAP.get("box15_state", "15")}
        field_sources["box15_employer_state_id"] = {
            "page": 1,
            "box": FIELD_BOX_MAP.get("box15_employer_state_id", "15"),
        }
    else:
        warnings.append("Missing state abbreviation (box 15)")

    if m := LOCALITY_RE.search(text):
        locality = m.group(1).strip()
        fields["box20_locality_name"] = locality
        fields_clean["box20_locality_name"] = locality
        field_confidence["box20_locality_name"] = 0.7
        field_sources["box20_locality_name"] = {"page": 1, "box": FIELD_BOX_MAP.get("box20_locality_name", "20")}

    required_keys = ["ein", "employee_ssn", "box1_wages", "box2_federal_income_tax_withheld"]
    for key in required_keys:
        if key not in fields_clean:
            if key == "employee_ssn":
                warnings.append("Missing normalized employee SSN")
            elif key == "ein":
                warnings.append("Missing normalized employer EIN")
            elif key == "box1_wages":
                warnings.append("Missing Box 1 wages")
            elif key == "box2_federal_income_tax_withheld":
                warnings.append("Missing Box 2 federal withholding")

    doc_conf = 0.55
    if "ein" in fields_clean:
        doc_conf += 0.1
    if "employee_ssn" in fields_clean:
        doc_conf += 0.1
    if "box1_wages" in fields_clean:
        doc_conf += 0.1
    if "box2_federal_income_tax_withheld" in fields_clean:
        doc_conf += 0.1
    if "box12" in fields_clean:
        doc_conf += 0.05
    if "box13_statutory_employee" in fields_clean or "box13_retirement_plan" in fields_clean:
        doc_conf += 0.05
    if "box16_state_wages" in fields_clean and "box17_state_income_tax" in fields_clean:
        doc_conf += 0.05
    if doc_conf > 0.95:
        doc_conf = 0.95
    missing_penalty = 0.05 * sum(1 for w in warnings if w.lower().startswith("missing"))
    if missing_penalty:
        doc_conf = max(0.3, doc_conf - missing_penalty)

    logger.info(
        "w2_form.extract",
        extra={
            "found": sorted(fields_clean.keys()),
            "warnings": warnings,
            "evidence_key": evidence_key,
        },
    )

    return {
        "doc_type": "W2_Form",
        "confidence": doc_conf,
        "fields": fields,
        "fields_clean": fields_clean,
        "field_confidence": field_confidence,
        "field_sources": field_sources,
        "warnings": warnings,
        "evidence_key": evidence_key,
    }


__all__ = ["detect", "extract"]
