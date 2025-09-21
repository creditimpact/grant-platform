from __future__ import annotations

import csv
import io
import re
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, Iterable, List, Optional, Tuple

import logging

logger = logging.getLogger(__name__)

TITLE_HINTS = [
    "1099 summary",
    "vendor 1099 summary",
    "1099 nec summary",
    "1099 report",
    "vendor 1099 report",
]
COLUMN_ALIASES: Dict[str, str] = {
    "vendor": "contractor.name",
    "vendor payee": "contractor.name",
    "payee": "contractor.name",
    "contractor": "contractor.name",
    "recipient": "contractor.name",
    "name": "contractor.name",
    "vendor name": "contractor.name",
    "tin": "contractor.tin",
    "tax id": "contractor.tin",
    "tax identification number": "contractor.tin",
    "ein": "contractor.tin",
    "ein ssn": "contractor.tin",
    "ein/ssn": "contractor.tin",
    "ssn": "contractor.tin",
    "nonemployee compensation": "amounts.box1_nonemployee_comp",
    "box 1": "amounts.box1_nonemployee_comp",
    "box1": "amounts.box1_nonemployee_comp",
    "total 1099 amount": "amounts.box1_nonemployee_comp",
    "1099 amount": "amounts.box1_nonemployee_comp",
    "nec": "amounts.box1_nonemployee_comp",
    "federal wh": "amounts.federal_wh",
    "federal withholding": "amounts.federal_wh",
    "federal tax withheld": "amounts.federal_wh",
    "backup wh": "amounts.federal_wh",
    "backup withholding": "amounts.federal_wh",
    "state wh": "amounts.state_wh",
    "state tax withheld": "amounts.state_wh",
    "state withholding": "amounts.state_wh",
    "state income": "amounts.state_income",
    "state taxable": "amounts.state_income",
    "total state income": "amounts.state_income",
    "account #": "metadata.account_number",
    "account number": "metadata.account_number",
    "acct #": "metadata.account_number",
}

TOTAL_KEY_MAP = {
    "box1_nonemployee_comp": "sum_box1",
    "federal_wh": "sum_federal_wh",
    "state_wh": "sum_state_wh",
    "state_income": "sum_state_income",
}

VENDOR_KEYWORDS = {
    "quickbooks": "QuickBooks",
    "intuit": "QuickBooks",
    "gusto": "Gusto",
    "adp": "ADP",
    "paychex": "Paychex",
}


def detect(text: str) -> bool:
    if not text:
        return False
    lowered = text.lower()
    hits = 0.0
    if any(hint in lowered for hint in TITLE_HINTS):
        hits += 1
    header_hits = sum(
        1 for alias in ("vendor", "contractor", "nonemployee compensation", "box 1") if alias in lowered
    )
    if header_hits >= 2:
        hits += 0.5
    if "tin" in lowered or "tax id" in lowered:
        hits += 0.5
    if "1099" in lowered and "summary" in lowered:
        hits += 0.5
    return hits >= 1.5


def _normalize_label(label: str) -> str:
    cleaned = re.sub(r"[\s\-/]+", " ", label.lower()).strip()
    cleaned = re.sub(r"[^a-z0-9# ]", "", cleaned)
    return cleaned


def _parse_money(token: str) -> Optional[float]:
    if token is None:
        return None
    cleaned = token.strip()
    if not cleaned:
        return None
    cleaned = cleaned.replace("$", "").replace(",", "")
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


def _coerce_row_cells(row: Iterable[str]) -> List[str]:
    cells: List[str] = []
    for cell in row:
        if cell is None:
            cells.append("")
        else:
            cells.append(str(cell).strip())
    return cells


def _map_header(cells: Iterable[str]) -> Dict[int, str]:
    mapping: Dict[int, str] = {}
    for idx, cell in enumerate(cells):
        key = COLUMN_ALIASES.get(_normalize_label(cell))
        if key:
            mapping[idx] = key
    return mapping


def _guess_vendor(text: str) -> Tuple[str, float]:
    lowered = text.lower()
    for needle, vendor in VENDOR_KEYWORDS.items():
        if needle in lowered:
            return vendor, 0.8
    return "Unknown", 0.3


def _extract_tax_year(text: str) -> Optional[str]:
    match = re.search(r"(?:tax|report)\s+year\s*[:\-]?\s*(20\d{2})", text, flags=re.IGNORECASE)
    if match:
        return match.group(1)
    match = re.search(r"\b20\d{2}\b", text)
    if match:
        return match.group(0)
    return None


def _iter_rows(text: str) -> List[List[str]]:
    stripped = text.strip()
    if "," in stripped and "\n" in stripped:
        reader = csv.reader(io.StringIO(stripped))
        rows = [_coerce_row_cells(row) for row in reader if any(cell.strip() for cell in row)]
        if rows:
            return rows
    rows: List[List[str]] = []
    for line in text.splitlines():
        cleaned = line.strip()
        if not cleaned:
            continue
        if "\t" in cleaned:
            cells = [cell.strip() for cell in cleaned.split("\t")]
        elif "|" in cleaned:
            cells = [cell.strip() for cell in cleaned.split("|")]
        else:
            cells = [cell.strip() for cell in re.split(r"\s{2,}", cleaned) if cell.strip()]
        rows.append(cells)
    return rows


def _is_totals_row(cells: List[str]) -> bool:
    if not cells:
        return False
    first = cells[0].lower()
    return first.startswith("total") or first.startswith("grand total")


def _accumulate(numbers: List[Optional[float]]) -> Optional[float]:
    clean = [n for n in numbers if isinstance(n, (int, float))]
    if not clean:
        return None
    return round(sum(clean), 2)


def _extract(
    text: str,
    *,
    doc_type: str,
    evidence_key: Optional[str] = None,
) -> Dict[str, Any]:
    rows = _iter_rows(text)
    header_row: Optional[List[str]] = None
    header_map: Dict[int, str] = {}
    start_index = 0
    for idx, row in enumerate(rows):
        mapping = _map_header(row)
        if mapping:
            header_row = row
            header_map = mapping
            start_index = idx + 1
            break
    warnings: List[str] = []
    if "amounts.box1_nonemployee_comp" not in header_map.values():
        warnings.append("missing_box1_column")

    contractors: List[Dict[str, Any]] = []
    field_sources: Dict[str, Dict[str, Any]] = {}
    field_confidence: Dict[str, float] = {}
    totals_row_values: Dict[str, float] = {}
    invalid_tins = False

    for row_idx, row in enumerate(rows[start_index:], start=start_index):
        cells = row
        if not cells or (len(cells) == 1 and not cells[0]):
            continue
        if _is_totals_row(cells):
            for col_idx, cell in enumerate(cells):
                key = header_map.get(col_idx)
                if key and key.startswith("amounts."):
                    parsed = _parse_money(cell)
                    if parsed is not None:
                        totals_row_values[key.split(".")[1]] = parsed
            continue
        entry: Dict[str, Any] = {
            "contractor": {"name": None, "tin_last4": None},
            "amounts": {
                "box1_nonemployee_comp": None,
                "federal_wh": None,
                "state_wh": None,
                "state_income": None,
            },
            "metadata": {"account_number": None},
        }
        seen_values = False
        for col_idx, cell in enumerate(cells):
            key = header_map.get(col_idx)
            if not key:
                continue
            value = cell.strip()
            if not value:
                continue
            seen_values = True
            base_source = {
                "page": 1,
                "row": row_idx + 1,
                "column": col_idx,
                "raw": value,
            }
            contractor_idx = len(contractors)
            source_key = f"contractors[{contractor_idx}].{key}"
            if key == "contractor.name":
                entry["contractor"]["name"] = value
                field_sources[source_key] = base_source
                field_confidence[source_key] = 0.85
            elif key == "contractor.tin":
                digits = re.sub(r"\D", "", value)
                if digits:
                    if len(digits) not in {4, 9}:
                        invalid_tins = True
                    entry["contractor"]["tin_last4"] = digits[-4:]
                field_sources[source_key] = base_source
                field_confidence[source_key] = 0.8
            elif key.startswith("amounts."):
                amount_key = key.split(".")[1]
                entry["amounts"][amount_key] = _parse_money(value)
                field_sources[source_key] = base_source
                field_confidence[source_key] = 0.8
            elif key == "metadata.account_number":
                entry["metadata"]["account_number"] = value
                field_sources[source_key] = base_source
                field_confidence[source_key] = 0.6
        if seen_values and entry["contractor"]["name"]:
            contractors.append(entry)

    if invalid_tins:
        warnings.append("invalid_tin_value")

    box1_values = [c["amounts"].get("box1_nonemployee_comp") for c in contractors]
    federal_values = [c["amounts"].get("federal_wh") for c in contractors]
    state_wh_values = [c["amounts"].get("state_wh") for c in contractors]
    state_income_values = [c["amounts"].get("state_income") for c in contractors]

    totals_clean: Dict[str, Optional[float]] = {
        "contractors_count": len(contractors),
        "sum_box1": _accumulate(box1_values) or 0.0,
        "sum_federal_wh": _accumulate(federal_values),
        "sum_state_wh": _accumulate(state_wh_values),
    }
    state_income_total = _accumulate(state_income_values)
    if state_income_total is not None:
        totals_clean["sum_state_income"] = state_income_total

    if totals_row_values:
        mismatch = False
        for key, reported in totals_row_values.items():
            target_key = TOTAL_KEY_MAP.get(key)
            if not target_key:
                continue
            actual = totals_clean.get(target_key)
            if actual is not None and abs(actual - reported) > 1.0:
                mismatch = True
                break
        if mismatch:
            warnings.append("totals_mismatch")

    tax_year = _extract_tax_year(text)
    if tax_year:
        field_sources["tax_year"] = {"page": 1, "row": 1, "column": 0, "raw": tax_year}
        field_confidence["tax_year"] = 0.75

    vendor_name, vendor_conf = _guess_vendor(text)
    field_sources["vendor_guess.name"] = {"page": 1, "row": 1, "column": 0, "raw": vendor_name}
    field_confidence["vendor_guess.name"] = vendor_conf

    for total_key, value in totals_clean.items():
        field_sources[f"totals.{total_key}"] = {"page": 1, "row": 0, "column": 0, "raw": value}
        field_confidence[f"totals.{total_key}"] = 0.7

    fields_clean: Dict[str, Any] = {
        "contractors": contractors,
        "totals": totals_clean,
        "vendor_guess": {"name": vendor_name, "confidence": vendor_conf},
    }
    if tax_year:
        fields_clean["tax_year"] = tax_year

    confidence = 0.55
    if contractors:
        confidence += 0.2
    if any(c["amounts"].get("box1_nonemployee_comp") for c in contractors):
        confidence += 0.15
    if vendor_name != "Unknown":
        confidence += 0.05
    if tax_year:
        confidence += 0.05
    confidence = min(confidence, 0.95)
    if "missing_box1_column" in warnings:
        confidence = max(0.3, confidence - 0.1)

    logger.info(
        "irs_1099_summary.extract",
        extra={
            "doc_type": doc_type,
            "rows": len(contractors),
            "warnings": warnings,
            "evidence_key": evidence_key,
        },
    )

    return {
        "doc_type": doc_type,
        "confidence": confidence,
        "fields": {"header": header_row or []},
        "fields_clean": fields_clean,
        "field_confidence": field_confidence,
        "field_sources": field_sources,
        "warnings": warnings,
        "evidence_key": evidence_key,
    }


def extract_form1099_summary(text: str, evidence_key: Optional[str] = None) -> Dict[str, Any]:
    return _extract(text, doc_type="Form1099_Summary", evidence_key=evidence_key)


def extract_vendor_1099_report(text: str, evidence_key: Optional[str] = None) -> Dict[str, Any]:
    return _extract(text, doc_type="Vendor_1099_Report", evidence_key=evidence_key)


__all__ = [
    "detect",
    "extract_form1099_summary",
    "extract_vendor_1099_report",
]
