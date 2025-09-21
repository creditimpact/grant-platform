from __future__ import annotations

import csv
import math
import re
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, Iterable, List, Optional, Tuple

PAY_PERIOD_RE = re.compile(
    r"Pay\s*Period\s*[:\-]?\s*(?P<start>[^\s]+)\s*(?:to|\-|through)\s*(?P<end>[^\s]+)",
    re.IGNORECASE,
)
CHECK_DATE_RE = re.compile(
    r"Check\s*Date\s*[:\-]?\s*(?P<date>[0-9]{1,2}[\-/][0-9]{1,2}[\-/][0-9]{2,4})",
    re.IGNORECASE,
)
FREQUENCY_HINTS = {
    "weekly": "weekly",
    "bi-weekly": "biweekly",
    "biweekly": "biweekly",
    "semi-monthly": "semimonthly",
    "semimonthly": "semimonthly",
    "monthly": "monthly",
}

VENDORS = {
    "adp": "ADP",
    "gusto": "Gusto",
    "quickbooks payroll": "QuickBooks Payroll",
    "intuit payroll": "QuickBooks Payroll",
    "paychex": "Paychex",
    "zenefits": "Zenefits",
}


def detect(text: str) -> bool:
    if not text:
        return False
    lowered = text.lower()
    required_hits = 0
    if "payroll" in lowered:
        required_hits += 1
    if "pay period" in lowered or "check date" in lowered:
        required_hits += 1
    if "gross pay" in lowered or "net pay" in lowered:
        required_hits += 1
    if "employee name" in lowered or "emp" in lowered:
        required_hits += 1
    return required_hits >= 3


def _normalize_label(label: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", label.lower()).strip()


COLUMN_ALIASES: Dict[str, str] = {
    "emp no": "employee.id",
    "emp number": "employee.id",
    "emp id": "employee.id",
    "employee id": "employee.id",
    "employee number": "employee.id",
    "employee name": "employee.name",
    "name": "employee.name",
    "worker": "employee.name",
    "ssn": "employee.ssn",
    "ssn last4": "employee.ssn",
    "social security": "employee.ssn",
    "gross pay": "pay_components.gross_pay",
    "total pay": "pay_components.gross_pay",
    "total earnings": "pay_components.gross_pay",
    "earnings": "pay_components.gross_pay",
    "regular pay": "pay_components.regular_pay",
    "regular hrs": "pay_components.regular_hours",
    "regular hours": "pay_components.regular_hours",
    "overtime pay": "pay_components.overtime_pay",
    "overtime": "pay_components.overtime_pay",
    "overtime hours": "pay_components.overtime_hours",
    "ot hours": "pay_components.overtime_hours",
    "bonus": "pay_components.bonus_pay",
    "bonus pay": "pay_components.bonus_pay",
    "vacation hours": "pay_components.vacation_hours",
    "vacation pay": "pay_components.vacation_pay",
    "sick hours": "pay_components.sick_hours",
    "sick pay": "pay_components.sick_pay",
    "other earnings": "pay_components.other_earnings",
    "federal wh": "withholding.federal_wh",
    "federal withholding": "withholding.federal_wh",
    "fed wh": "withholding.federal_wh",
    "oasdi": "withholding.social_security",
    "social security tax": "withholding.social_security",
    "fica": "withholding.social_security",
    "medicare": "withholding.medicare",
    "state wh": "withholding.state_wh",
    "state withholding": "withholding.state_wh",
    "local wh": "withholding.local_wh",
    "local withholding": "withholding.local_wh",
    "net pay": "net_pay",
    "check date": "pay_period.check_date",
    "pay period start": "pay_period.start_date",
    "pay period end": "pay_period.end_date",
    "period start": "pay_period.start_date",
    "period end": "pay_period.end_date",
    "start date": "pay_period.start_date",
    "end date": "pay_period.end_date",
    "ytd gross": "ytd.total_pay",
    "ytd total": "ytd.total_pay",
    "ytd wages": "ytd.total_pay",
    "ytd federal": "ytd.federal_wh",
    "ytd fed": "ytd.federal_wh",
    "ytd oasdi": "ytd.social_security",
    "ytd social security": "ytd.social_security",
    "ytd medicare": "ytd.medicare",
    "ytd state": "ytd.state_wh",
    "ytd net": "ytd.net_pay",
}

REQUIRED_KEYS = {"employee.name", "net_pay"}


@dataclass
class ParsedRow:
    index: int
    values: List[str]
    raw_line: str


def _split_rows(text: str) -> List[ParsedRow]:
    rows: List[ParsedRow] = []
    for idx, line in enumerate(text.splitlines()):
        raw = line.rstrip("\n")
        cleaned = raw.strip()
        if not cleaned or set(cleaned) <= {"-", "=", "_"}:
            continue
        if cleaned.lower().startswith("page "):
            continue
        if cleaned.lower().startswith("totals") and "," not in cleaned and "\t" not in cleaned:
            # allow totals line to be processed later as tokens
            pass
        rows.append(ParsedRow(index=idx, values=_split_cells(cleaned), raw_line=raw))
    return rows


def _split_cells(line: str) -> List[str]:
    if "," in line:
        reader = csv.reader([line], skipinitialspace=True)
        return [cell.strip() for cell in next(reader)]
    if "\t" in line:
        return [cell.strip() for cell in line.split("\t")]
    parts = re.split(r"\s{2,}", line)
    return [part.strip() for part in parts if part.strip()]


def _map_header(cells: Iterable[str]) -> Dict[int, str]:
    mapping: Dict[int, str] = {}
    for idx, cell in enumerate(cells):
        key = COLUMN_ALIASES.get(_normalize_label(cell))
        if key:
            mapping[idx] = key
    return mapping


def _parse_money(token: str) -> Optional[float]:
    if token is None:
        return None
    cleaned = token.strip()
    if not cleaned:
        return None
    cleaned = cleaned.replace("$", "")
    cleaned = cleaned.replace(",", "")
    cleaned = cleaned.replace("O", "0").replace("o", "0")
    cleaned = cleaned.replace("—", "-")
    if cleaned.startswith("(") and cleaned.endswith(")"):
        cleaned = f"-{cleaned[1:-1]}"
    cleaned = re.sub(r"[^0-9.\-]", "", cleaned)
    if cleaned in {"", "-", "."}:
        return None
    try:
        return float(Decimal(cleaned))
    except (InvalidOperation, ValueError):
        return None


def _parse_hours(token: str) -> Optional[float]:
    value = _parse_money(token)
    if value is None:
        return None
    return round(value, 4)


def _parse_date(token: str) -> Optional[str]:
    if not token:
        return None
    token_clean = token.strip()
    for fmt in ("%m/%d/%Y", "%m/%d/%y", "%Y-%m-%d", "%Y/%m/%d", "%b %d, %Y", "%B %d, %Y"):
        try:
            return datetime.strptime(token_clean, fmt).date().isoformat()
        except ValueError:
            continue
    return None


def _mask_ssn(value: str) -> Optional[str]:
    digits = re.sub(r"\D", "", value or "")
    if len(digits) >= 4:
        return digits[-4:]
    return None


def _infer_frequency(start: Optional[str], end: Optional[str], text: str) -> str:
    lowered = text.lower()
    for token, mapped in FREQUENCY_HINTS.items():
        if token in lowered:
            return mapped
    if start and end:
        try:
            dt_start = datetime.fromisoformat(start)
            dt_end = datetime.fromisoformat(end)
            delta = (dt_end - dt_start).days
            if delta <= 7:
                return "weekly"
            if 10 <= delta <= 15:
                return "biweekly"
            if 15 <= delta <= 17:
                return "semimonthly"
            if delta >= 27:
                return "monthly"
        except ValueError:
            pass
    return "unknown"


def _guess_vendor(text: str) -> Tuple[Optional[str], float]:
    lowered = text.lower()
    for token, name in VENDORS.items():
        if token in lowered:
            return name, 0.85
    return None, 0.0


def _ensure_employee_structure() -> Dict[str, Any]:
    return {
        "employee": {"id": None, "name": None, "ssn_last4": None},
        "pay_components": {
            "regular_hours": None,
            "regular_pay": None,
            "overtime_hours": None,
            "overtime_pay": None,
            "vacation_hours": None,
            "vacation_pay": None,
            "sick_hours": None,
            "sick_pay": None,
            "bonus_pay": None,
            "other_earnings": [],
            "gross_pay": None,
        },
        "withholding": {
            "federal_wh": None,
            "state_wh": None,
            "local_wh": None,
            "social_security": None,
            "medicare": None,
        },
        "deductions_employee": [],
        "employer_taxes_contribs": [],
        "net_pay": None,
        "ytd": {
            "regular_pay": None,
            "total_pay": None,
            "federal_wh": None,
            "social_security": None,
            "medicare": None,
            "state_wh": None,
            "net_pay": None,
            "other": [],
        },
    }


def extract(text: str, evidence_key: Optional[str] = None) -> Dict[str, Any]:
    if not detect(text):
        return {
            "doc_type": None,
            "confidence": 0.0,
            "fields": {},
            "fields_clean": {},
            "field_confidence": {},
            "field_sources": {},
            "warnings": ["Unable to detect payroll register layout"],
            "parse_summary": {},
            "vendor_guess": {"name": None, "confidence": 0.0},
            "evidence_key": evidence_key,
        }

    rows = _split_rows(text)
    header_map: Dict[int, str] = {}
    header_row: Optional[ParsedRow] = None
    for row in rows:
        mapping = _map_header(row.values)
        if mapping and (
            "employee.name" in mapping.values()
            and ("net_pay" in mapping.values() or "pay_components.gross_pay" in mapping.values())
        ):
            header_map = mapping
            header_row = row
            break

    warnings: List[str] = []
    if not header_row:
        warnings.append("Unable to identify table header")
        header_row = ParsedRow(index=0, values=[], raw_line="")

    mapped_columns = set(header_map.values())
    missing_columns = sorted(k for k in REQUIRED_KEYS if k not in mapped_columns)
    if missing_columns:
        warnings.append(f"Missing expected columns: {', '.join(missing_columns)}")

    pay_period_start = pay_period_end = check_date = None
    if header_row:
        header_text_prefix = "\n".join(
            line for line in text.splitlines()[: header_row.index]
        )
    else:
        header_text_prefix = text

    if match := PAY_PERIOD_RE.search(text):
        pay_period_start = _parse_date(match.group("start")) or pay_period_start
        pay_period_end = _parse_date(match.group("end")) or pay_period_end
    if match := CHECK_DATE_RE.search(text):
        check_date = _parse_date(match.group("date")) or check_date

    employees: List[Dict[str, Any]] = []
    field_sources: Dict[str, Dict[str, Any]] = {}
    field_confidence: Dict[str, float] = {}

    rows_parsed = 0
    rows_skipped = 0
    totals_candidate: Optional[Dict[str, float]] = None

    start_collecting = False if header_row else True
    for row in rows:
        if row is header_row:
            start_collecting = True
            continue
        if not start_collecting:
            continue
        normalized_first = row.values[0].strip().lower() if row.values else ""
        if normalized_first in {"totals", "total"}:
            totals_candidate = {}
            for idx, cell in enumerate(row.values):
                key = header_map.get(idx)
                if not key:
                    continue
                amount = _parse_money(cell)
                if amount is not None:
                    totals_candidate[key] = amount
            continue

        entry = _ensure_employee_structure()
        row_has_value = False
        for idx, cell in enumerate(row.values):
            key = header_map.get(idx)
            if not key:
                continue
            if key.startswith("pay_period."):
                parsed = _parse_date(cell)
                if key.endswith("start_date") and parsed:
                    pay_period_start = pay_period_start or parsed
                elif key.endswith("end_date") and parsed:
                    pay_period_end = pay_period_end or parsed
                elif key.endswith("check_date") and parsed:
                    check_date = check_date or parsed
                continue
            if key == "employee.id":
                entry["employee"]["id"] = cell.strip() or None
                field_path = f"employees[{len(employees)}].employee.id"
            elif key == "employee.name":
                entry["employee"]["name"] = cell.strip() or None
                field_path = f"employees[{len(employees)}].employee.name"
            elif key == "employee.ssn":
                entry["employee"]["ssn_last4"] = _mask_ssn(cell)
                field_path = f"employees[{len(employees)}].employee.ssn_last4"
            elif key.startswith("pay_components."):
                amount_key = key.split(".", 1)[1]
                if amount_key.endswith("hours"):
                    value = _parse_hours(cell)
                elif amount_key == "other_earnings":
                    value = _parse_money(cell)
                    if value is not None:
                        entry["pay_components"]["other_earnings"].append(
                            {"label": "Other", "amount": value}
                        )
                    field_path = f"employees[{len(employees)}].pay_components.other_earnings"
                    field_sources.setdefault(field_path, {"line": row.index + 1, "column": idx, "raw": cell})
                    field_confidence[field_path] = 0.6
                    continue
                else:
                    value = _parse_money(cell)
                entry["pay_components"][amount_key] = value
                field_path = f"employees[{len(employees)}].pay_components.{amount_key}"
            elif key.startswith("withholding."):
                amount_key = key.split(".", 1)[1]
                entry["withholding"][amount_key] = _parse_money(cell)
                field_path = f"employees[{len(employees)}].withholding.{amount_key}"
            elif key == "net_pay":
                entry["net_pay"] = _parse_money(cell)
                field_path = f"employees[{len(employees)}].net_pay"
            elif key.startswith("ytd."):
                amount_key = key.split(".", 1)[1]
                entry["ytd"][amount_key] = _parse_money(cell)
                field_path = f"employees[{len(employees)}].ytd.{amount_key}"
            else:
                continue
            field_sources[field_path] = {
                "line": row.index + 1,
                "column": idx,
                "raw": cell,
            }
            field_confidence[field_path] = 0.7
            if cell.strip():
                row_has_value = True

        if not entry["employee"].get("name"):
            rows_skipped += 1
            continue

        rows_parsed += 1
        employees.append(entry)

    totals = _aggregate_totals(employees)

    if totals_candidate and totals_candidate.get("pay_components.gross_pay") is not None:
        diff = abs(totals["gross"] - totals_candidate.get("pay_components.gross_pay", 0.0))
        if diff > 0.05:
            warnings.append(
                f"Totals do not reconcile (+${diff:.2f})"
            )

    withholding_total = totals["withholding"]
    deductions_total = totals["deductions_employee"]
    gross_total = totals["gross"]
    net_total = totals["net"]
    if not math.isclose(gross_total - withholding_total - deductions_total, net_total, abs_tol=0.05):
        warnings.append("Per-employee totals do not reconcile to net pay")

    vendor_name, vendor_conf = _guess_vendor(text)

    pay_period = {
        "start_date": pay_period_start,
        "end_date": pay_period_end,
        "check_date": check_date,
        "frequency": _infer_frequency(pay_period_start, pay_period_end, text),
    }

    parse_summary = {
        "rows_parsed": rows_parsed,
        "rows_skipped": rows_skipped,
        "columns_mapped": len(mapped_columns),
        "columns_missing": missing_columns,
    }

    field_confidence.update(
        {
            "pay_period.start_date": 0.75 if pay_period_start else 0.0,
            "pay_period.end_date": 0.75 if pay_period_end else 0.0,
            "pay_period.check_date": 0.7 if check_date else 0.0,
            "pay_period.frequency": 0.6,
        }
    )

    field_sources.update(
        {
            "pay_period.start_date": {"line": 1, "column": "header", "raw": pay_period_start},
            "pay_period.end_date": {"line": 1, "column": "header", "raw": pay_period_end},
            "pay_period.check_date": {"line": 1, "column": "header", "raw": check_date},
            "pay_period.frequency": {"line": 0, "column": None, "raw": pay_period["frequency"]},
        }
    )

    fields_clean = {
        "pay_period": pay_period,
        "employees": employees,
        "document_totals": totals,
        "employee_count": len(employees),
    }

    confidence = 0.6
    if employees:
        confidence += 0.2
    if pay_period_start and pay_period_end:
        confidence += 0.1
    if totals["gross"] > 0 and totals["net"] > 0:
        confidence += 0.05
    confidence = min(confidence, 0.95)

    result = {
        "doc_type": "Payroll_Register",
        "confidence": confidence,
        "fields": {"header": header_row.values if header_row else []},
        "fields_clean": fields_clean,
        "field_confidence": field_confidence,
        "field_sources": field_sources,
        "warnings": warnings,
        "parse_summary": parse_summary,
        "vendor_guess": {"name": vendor_name, "confidence": vendor_conf},
        "evidence_key": evidence_key,
    }
    return result


def _aggregate_totals(employees: List[Dict[str, Any]]) -> Dict[str, float]:
    gross_total = 0.0
    withholding_total = 0.0
    employer_total = 0.0
    deductions_total = 0.0
    net_total = 0.0
    for entry in employees:
        pay_comp = entry.get("pay_components", {})
        gross = pay_comp.get("gross_pay")
        if gross is None:
            components = [
                pay_comp.get("regular_pay"),
                pay_comp.get("overtime_pay"),
                pay_comp.get("vacation_pay"),
                pay_comp.get("sick_pay"),
                pay_comp.get("bonus_pay"),
            ]
            gross = sum(v for v in components if isinstance(v, (int, float)))
        gross_total += gross or 0.0

        withholding = entry.get("withholding", {})
        withholding_total += sum(
            v for v in [
                withholding.get("federal_wh"),
                withholding.get("state_wh"),
                withholding.get("local_wh"),
                withholding.get("social_security"),
                withholding.get("medicare"),
            ]
            if isinstance(v, (int, float))
        )

        for item in entry.get("deductions_employee", []) or []:
            amount = item.get("amount")
            if isinstance(amount, (int, float)):
                deductions_total += amount

        for item in entry.get("employer_taxes_contribs", []) or []:
            amount = item.get("amount")
            if isinstance(amount, (int, float)):
                employer_total += amount

        net = entry.get("net_pay")
        if isinstance(net, (int, float)):
            net_total += net

    return {
        "gross": round(gross_total, 2),
        "withholding": round(withholding_total, 2),
        "employer_taxes": round(employer_total, 2),
        "deductions_employee": round(deductions_total, 2),
        "net": round(net_total, 2),
    }


__all__ = ["detect", "extract"]
