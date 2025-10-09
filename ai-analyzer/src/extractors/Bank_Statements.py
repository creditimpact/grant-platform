from __future__ import annotations

import logging
import math
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Iterable, Tuple

from document_library import catalog_index
from document_library.aliases import get_aliases_for


LOG_DIRECTORY = Path("/tmp/session_diagnostics")
LOG_DIRECTORY.mkdir(parents=True, exist_ok=True)
LOG_PATH = LOG_DIRECTORY / "bank_statement_extraction.log"


logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

_has_handler = any(
    isinstance(handler, logging.FileHandler)
    and getattr(handler, "_bank_statement_handler", False)
    for handler in logger.handlers
)

if not _has_handler:
    file_handler = logging.FileHandler(LOG_PATH, mode="a", encoding="utf-8")
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(
        logging.Formatter("%(asctime)s %(levelname)s %(message)s")
    )
    file_handler._bank_statement_handler = True  # type: ignore[attr-defined]
    logger.addHandler(file_handler)


DATE_FORMATS = (
    "%Y-%m-%d",
    "%m/%d/%Y",
    "%m/%d/%y",
    "%b %d %Y",
    "%b %d, %Y",
    "%B %d %Y",
    "%B %d, %Y",
    "%b %d %y",
    "%b %d, %y",
    "%B %d %y",
    "%B %d, %y",
)


DATE_TOKEN = (
    r"(?:[A-Za-z]{3,9}\.?\s+\d{1,2}(?:st|nd|rd|th)?(?:,\s*\d{2,4})?)"
    r"|(?:\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?)"
    r"|(?:\d{4}-\d{1,2}-\d{1,2})"
)
RANGE_SEPARATOR = r"(?:to|through|thru|\-|–|—|\u2013|\u2014)"


COMBINED_PERIOD_PATTERNS = [
    re.compile(
        rf"(?is)(?:statement|billing)\s+(?:period|cycle)[:\-\s]*"
        rf"(?P<start>{DATE_TOKEN})\s*{RANGE_SEPARATOR}\s*(?P<end>{DATE_TOKEN})"
    ),
    re.compile(
        rf"(?is)period\s+covered(?:\s+by)?[:\-\s]*"
        rf"(?P<start>{DATE_TOKEN})\s*{RANGE_SEPARATOR}\s*(?P<end>{DATE_TOKEN})"
    ),
    re.compile(
        rf"(?is)for\s+the\s+period(?:\s+of)?[:\-\s]*"
        rf"(?P<start>{DATE_TOKEN})\s*{RANGE_SEPARATOR}\s*(?P<end>{DATE_TOKEN})"
    ),
    re.compile(
        rf"(?is)(?P<start>{DATE_TOKEN})\s*{RANGE_SEPARATOR}\s*(?P<end>{DATE_TOKEN})"
    ),
]


NUMERIC_FALLBACKS: Dict[str, Tuple[re.Pattern[str], ...]] = {
    "beginning_balance": (
        re.compile(
            r"(?i)\b(?:beginning|opening|start)\s+balance[:\s]*\$?\s*(\(?-?[\d,]+(?:\.\d{2})?\)?)"
        ),
    ),
    "ending_balance": (
        re.compile(
            r"(?i)\b(?:ending|closing|end)\s+balance[:\s]*\$?\s*(\(?-?[\d,]+(?:\.\d{2})?\)?)"
        ),
    ),
    "totals.deposits": (
        re.compile(
            r"(?i)\b(?:total\s+)?(?:credits?|deposits?)[:\s]*[-\$]?\s*(\(?-?[\d,]+(?:\.\d{2})?\)?)"
        ),
    ),
    "totals.withdrawals": (
        re.compile(
            r"(?i)\b(?:total\s+)?(?:debits?|withdrawals?|checks\s+paid)[:\s]*[-\$]?\s*(\(?-?[\d,]+(?:\.\d{2})?\)?)"
        ),
    ),
}


ACCOUNT_PATTERN = re.compile(
    r"(?i)account(?:\s+(?:number|no\.?|#|ending\s+in|id))?[:\-\s]*"
    r"(?:[xX\*#\-\s]+)?(\d{4,})"
)


def _schema_fields() -> Tuple[str, ...]:
    definition = catalog_index().get("Bank_Statements")
    return definition.schema_fields if definition else ()


def _normalize_numeric_token(token: str | None) -> str | None:
    if not token:
        return None
    cleaned = token.strip()
    if not cleaned:
        return None
    negative = False
    if cleaned.startswith("(") and cleaned.endswith(")"):
        negative = True
        cleaned = cleaned[1:-1]
    cleaned = cleaned.replace("$", "").replace(",", "").replace(" ", "")
    cleaned = cleaned.replace("−", "-").replace("—", "-")
    if cleaned.startswith("-"):
        negative = True
        cleaned = cleaned[1:]
    cleaned = re.sub(r"[^0-9.]", "", cleaned)
    if not cleaned:
        return None
    if cleaned.startswith("."):
        cleaned = f"0{cleaned}"
    value = cleaned
    return f"-{value}" if negative and value not in {"0", "0.0", "0.00"} else value


def _normalize_date_token(token: str | None, *, default_year: int | None = None) -> str | None:
    if not token:
        return None
    cleaned = token.strip()
    if not cleaned:
        return None
    cleaned = re.sub(r"(\d{1,2})(st|nd|rd|th)", r"\1", cleaned, flags=re.IGNORECASE)
    cleaned = cleaned.replace(",", " ")
    year_match = re.search(r"\b(\d{4})\b", cleaned)
    if year_match:
        default_year = int(year_match.group(1))
    elif default_year is not None:
        cleaned = f"{cleaned} {default_year}"

    for fmt in DATE_FORMATS:
        try:
            parsed = datetime.strptime(cleaned, fmt).date()
            return parsed.isoformat()
        except ValueError:
            continue
    return None


def _extract_numeric_field(text: str, aliases: Iterable[str], key: str) -> tuple[str | None, str | None]:
    for alias in aliases:
        alias_text = alias.strip()
        if not alias_text:
            continue
        pattern = re.compile(
            rf"{re.escape(alias_text)}[:\-\s]*\$?\s*(\(?-?[0-9][0-9,]*(?:\.[0-9]+)?\)?)",
            re.IGNORECASE,
        )
        match = pattern.search(text)
        if match:
            raw = match.group(1)
            normalized = _normalize_numeric_token(raw)
            if normalized is not None:
                return normalized, raw.strip()

    for pattern in NUMERIC_FALLBACKS.get(key, ()):  # pragma: no branch - small tuple
        match = pattern.search(text)
        if match:
            raw = match.group(1)
            normalized = _normalize_numeric_token(raw)
            if normalized is not None:
                return normalized, raw.strip()

    return None, None


def _extract_text_field(text: str, aliases: Iterable[str]) -> str | None:
    for alias in aliases:
        alias_text = alias.strip()
        if not alias_text:
            continue
        pattern = re.compile(rf"{re.escape(alias_text)}[:\-\s]*([^\n]+)", re.IGNORECASE)
        match = pattern.search(text)
        if match:
            value = match.group(1).strip()
            if value:
                return value
    return None


def _extract_account_last4(text: str, aliases: Iterable[str]) -> tuple[str | None, str | None]:
    for alias in aliases:
        alias_text = alias.strip()
        if not alias_text:
            continue
        pattern = re.compile(
            rf"{re.escape(alias_text)}[:\-\s]*([^\n]+)",
            re.IGNORECASE,
        )
        match = pattern.search(text)
        if match:
            segment = match.group(1)
            digits = re.sub(r"[^0-9]", "", segment)
            if digits:
                return digits[-4:], match.group(0).strip()

    fallback_line = re.search(r"(?i)account[^\n]*", text)
    if fallback_line:
        digits = re.sub(r"[^0-9]", "", fallback_line.group(0))
        if digits:
            return digits[-4:], fallback_line.group(0).strip()
    return None, None


def _extract_date_with_aliases(text: str, aliases: Iterable[str]) -> tuple[str | None, str | None]:
    for alias in aliases:
        alias_text = alias.strip()
        if not alias_text:
            continue
        pattern = re.compile(rf"{re.escape(alias_text)}[:\-\s]*({DATE_TOKEN})", re.IGNORECASE)
        match = pattern.search(text)
        if match:
            return match.group(1).strip(), match.group(0).strip()
    return None, None


def _extract_statement_period(
    text: str,
    start_aliases: Iterable[str],
    end_aliases: Iterable[str],
) -> tuple[str | None, str | None, str | None, str | None]:
    for pattern in COMBINED_PERIOD_PATTERNS:
        match = pattern.search(text)
        if match:
            return (
                match.group("start").strip(),
                match.group("end").strip(),
                match.group(0).strip(),
                match.group(0).strip(),
            )

    start_token, start_raw = _extract_date_with_aliases(text, start_aliases)
    end_token, end_raw = _extract_date_with_aliases(text, end_aliases)
    return start_token, end_token, start_raw, end_raw


def _assign_field(container: Dict[str, Any], field: str, value: Any) -> None:
    parts = field.split(".")
    cursor: Dict[str, Any] = container
    for part in parts[:-1]:
        cursor = cursor.setdefault(part, {})
    cursor[parts[-1]] = value


def _has_value(container: Dict[str, Any], field: str) -> bool:
    parts = field.split(".")
    current: Any = container
    for part in parts:
        if not isinstance(current, dict) or part not in current:
            return False
        current = current[part]
    return current is not None


def _safe_float(value: str | None) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _format_log_currency(raw: str | None, normalized: str | None) -> str:
    if raw:
        token = raw.strip()
        if token.startswith("$") or token.startswith("(") or token.startswith("-"):
            return token
        return f"${token}"
    if normalized:
        if normalized.startswith("-"):
            return f"-${normalized[1:]}"
        return f"${normalized}"
    return ""


def extract(text: str) -> dict[str, Any]:
    cleaned = text or ""
    aliases = get_aliases_for("Bank_Statements")
    schema = set(_schema_fields())

    extracted_values: Dict[str, Any] = {}
    field_confidence: Dict[str, float] = {}
    field_details: Dict[str, Dict[str, Any]] = {}
    warnings: list[str] = []

    logger.debug("[DEBUG] Starting bank statement extraction")

    start_token, end_token, start_raw, end_raw = _extract_statement_period(
        cleaned,
        aliases.get("statement_period.start", []),
        aliases.get("statement_period.end", []),
    )

    default_year = None
    if end_token:
        year_match = re.search(r"\b(\d{4})\b", end_token)
        if year_match:
            default_year = int(year_match.group(1))
    elif start_token:
        year_match = re.search(r"\b(\d{4})\b", start_token)
        if year_match:
            default_year = int(year_match.group(1))

    start_iso = _normalize_date_token(start_token, default_year=default_year)
    end_iso = _normalize_date_token(end_token, default_year=default_year)

    if start_iso:
        field_details["statement_period.start"] = {
            "value": start_iso,
            "raw": start_raw or start_token,
            "confidence": 0.6,
        }
    if end_iso:
        field_details["statement_period.end"] = {
            "value": end_iso,
            "raw": end_raw or end_token,
            "confidence": 0.6,
        }

    account_last4, account_raw = _extract_account_last4(
        cleaned, aliases.get("account_number_last4", [])
    )
    if account_last4:
        field_details["account_number_last4"] = {
            "value": account_last4,
            "raw": account_raw,
            "confidence": 0.65,
        }

    bank_name = _extract_text_field(cleaned, aliases.get("bank_name", []))
    if bank_name:
        field_details["bank_name"] = {
            "value": bank_name.strip(),
            "raw": bank_name.strip(),
            "confidence": 0.55,
        }

    holder_name = _extract_text_field(
        cleaned, aliases.get("account_holder_name", [])
    )
    if holder_name:
        field_details["account_holder_name"] = {
            "value": holder_name.strip(),
            "raw": holder_name.strip(),
            "confidence": 0.55,
        }

    beginning_balance, beginning_raw = _extract_numeric_field(
        cleaned, aliases.get("beginning_balance", []), "beginning_balance"
    )
    ending_balance, ending_raw = _extract_numeric_field(
        cleaned, aliases.get("ending_balance", []), "ending_balance"
    )
    total_deposits, deposits_raw = _extract_numeric_field(
        cleaned, aliases.get("totals.deposits", []), "totals.deposits"
    )
    total_withdrawals, withdrawals_raw = _extract_numeric_field(
        cleaned, aliases.get("totals.withdrawals", []), "totals.withdrawals"
    )

    if beginning_balance is not None:
        field_details["beginning_balance"] = {
            "value": beginning_balance,
            "raw": beginning_raw,
            "confidence": 0.65,
        }
    if ending_balance is not None:
        field_details["ending_balance"] = {
            "value": ending_balance,
            "raw": ending_raw,
            "confidence": 0.65,
        }
    if total_deposits is not None:
        field_details["totals.deposits"] = {
            "value": total_deposits,
            "raw": deposits_raw,
            "confidence": 0.6,
        }
    if total_withdrawals is not None:
        field_details["totals.withdrawals"] = {
            "value": total_withdrawals,
            "raw": withdrawals_raw,
            "confidence": 0.6,
        }

    if beginning_raw or ending_raw:
        begin_for_log = _format_log_currency(beginning_raw, beginning_balance)
        end_for_log = _format_log_currency(ending_raw, ending_balance)
        logger.debug(
            "[DEBUG] Extracted beginning_balance=%s, ending_balance=%s",
            begin_for_log,
            end_for_log,
        )

    if start_token and end_token:
        logger.debug(
            "[DEBUG] Detected statement period: %s – %s",
            start_token.strip(),
            end_token.strip(),
        )

    begin_float = _safe_float(beginning_balance)
    end_float = _safe_float(ending_balance)
    deposits_float = _safe_float(total_deposits)
    withdrawals_float = _safe_float(total_withdrawals)

    if start_iso and end_iso:
        try:
            if datetime.fromisoformat(start_iso) <= datetime.fromisoformat(end_iso):
                for key in ("statement_period.start", "statement_period.end"):
                    if key in field_details:
                        field_details[key]["confidence"] += 0.2
            else:
                warnings.append("Statement period start is after end")
        except ValueError:
            warnings.append("Statement period contains invalid dates")

    if None not in (begin_float, end_float, deposits_float, withdrawals_float):
        expected_end = begin_float + deposits_float - withdrawals_float
        tolerance = max(0.5, 0.005 * max(abs(expected_end), 1))
        if math.isfinite(expected_end) and abs(expected_end - end_float) <= tolerance:
            for key in (
                "beginning_balance",
                "ending_balance",
                "totals.deposits",
                "totals.withdrawals",
            ):
                if key in field_details:
                    field_details[key]["confidence"] += 0.2
        else:
            warnings.append("Balance reconciliation failed validation")

    for key, detail in field_details.items():
        if key not in schema:
            continue
        value = detail.get("value")
        if value is None:
            continue
        _assign_field(extracted_values, key, value)
        conf = float(detail.get("confidence", 0.5))
        field_confidence[key] = round(min(max(conf, 0.0), 0.99), 2)

    doc_conf = 0.45
    core_fields = [
        "account_number_last4",
        "statement_period.start",
        "statement_period.end",
        "beginning_balance",
        "ending_balance",
    ]
    for field in core_fields:
        if _has_value(extracted_values, field):
            doc_conf += 0.08
    if _has_value(extracted_values, "totals.deposits") and _has_value(
        extracted_values, "totals.withdrawals"
    ):
        doc_conf += 0.06
    if warnings:
        doc_conf = max(0.35, doc_conf - 0.1)
    doc_conf = min(doc_conf, 0.95)

    logger.debug(
        "[DEBUG] Field confidence summary: %s",
        {k: field_confidence.get(k) for k in sorted(field_confidence)},
    )
    if warnings:
        logger.debug("[DEBUG] Extraction warnings: %s", warnings)

    return {
        "fields": extracted_values,
        "field_confidence": field_confidence,
        "confidence": round(doc_conf, 2),
        "warnings": warnings,
        "log_path": str(LOG_PATH),
    }


__all__ = ["extract"]
