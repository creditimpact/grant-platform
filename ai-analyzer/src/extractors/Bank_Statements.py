from __future__ import annotations

import logging
import re
from typing import Any, Dict, Iterable, Tuple

from document_library import catalog_index
from document_library.aliases import get_aliases_for


logger = logging.getLogger(__name__)
logger.debug("[DEBUG] Bank_Statements extractor successfully imported.")

DATE_TOKEN = r"(?:[A-Za-z]{3,9}\s+\d{1,2},?\s*\d{2,4}|\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}-\d{1,2}-\d{1,2})"
RANGE_SEPARATOR = r"(?:to|through|thru|\-|–|—)"

COMBINED_PERIOD_PATTERNS = [
    re.compile(
        rf"(?i)(?:statement|billing)\s+(?:period|cycle)[:\-\s]*"
        rf"(?P<start>{DATE_TOKEN})\s*{RANGE_SEPARATOR}\s*(?P<end>{DATE_TOKEN})"
    ),
    re.compile(
        rf"(?i)period\s+covered(?:\s+by)?[:\-\s]*"
        rf"(?P<start>{DATE_TOKEN})\s*{RANGE_SEPARATOR}\s*(?P<end>{DATE_TOKEN})"
    ),
]


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


def _extract_numeric_field(text: str, aliases: Iterable[str]) -> str | None:
    for alias in aliases:
        pattern = re.compile(
            rf"{re.escape(alias)}[:\-\s]*\$?\s*(\(?-?[0-9][0-9,]*(?:\.[0-9]+)?\)?)",
            re.IGNORECASE,
        )
        match = pattern.search(text)
        if match:
            normalized = _normalize_numeric_token(match.group(1))
            if normalized is not None:
                return normalized
    return None


def _extract_text_field(text: str, aliases: Iterable[str]) -> str | None:
    for alias in aliases:
        pattern = re.compile(rf"{re.escape(alias)}[:\-\s]*([^\n]+)", re.IGNORECASE)
        match = pattern.search(text)
        if match:
            value = match.group(1).strip()
            if value:
                return value
    return None


def _extract_account_last4(text: str, aliases: Iterable[str]) -> str | None:
    for alias in aliases:
        pattern = re.compile(
            rf"{re.escape(alias)}[:\-\s]*(?:[xX\*#\s-]+)?([0-9]{{4,}})",
            re.IGNORECASE,
        )
        match = pattern.search(text)
        if match:
            digits = re.sub(r"[^0-9]", "", match.group(1))
            if digits:
                return digits[-4:]
    fallback = re.search(
        r"(?i)account\s+(?:number|ending\s+in|no\.?|#)[:\-\s]*(?:[xX\*#\s-]+)?([0-9]{4,})",
        text,
    )
    if fallback:
        digits = re.sub(r"[^0-9]", "", fallback.group(1))
        if digits:
            return digits[-4:]
    return None


def _extract_currency(text: str, aliases: Iterable[str]) -> str | None:
    for alias in aliases:
        alias_text = alias.strip()
        if not alias_text:
            continue
        pattern = re.compile(rf"{re.escape(alias_text)}[:\-\s]*([A-Z]{{3}})", re.IGNORECASE)
        match = pattern.search(text)
        if match:
            return match.group(1).upper()
        if len(alias_text) == 3 and alias_text.isalpha():
            code_match = re.search(rf"\b{re.escape(alias_text)}\b", text, re.IGNORECASE)
            if code_match:
                return alias_text.upper()
    fallback = re.search(r"\b(USD|EUR|GBP|CAD|AUD)\b", text, re.IGNORECASE)
    if fallback:
        return fallback.group(1).upper()
    return None


def _extract_date_with_aliases(text: str, aliases: Iterable[str]) -> str | None:
    for alias in aliases:
        pattern = re.compile(rf"{re.escape(alias)}[:\-\s]*({DATE_TOKEN})", re.IGNORECASE)
        match = pattern.search(text)
        if match:
            return match.group(1).strip()
    return None


def _extract_statement_period(
    text: str, start_aliases: Iterable[str], end_aliases: Iterable[str]
) -> Tuple[str | None, str | None]:
    for pattern in COMBINED_PERIOD_PATTERNS:
        match = pattern.search(text)
        if match:
            return match.group("start").strip(), match.group("end").strip()

    start = _extract_date_with_aliases(text, start_aliases)
    end = _extract_date_with_aliases(text, end_aliases)
    return start, end


def _assign_field(container: Dict[str, Any], field: str, value: Any) -> None:
    parts = field.split(".")
    cursor: Dict[str, Any] = container
    for part in parts[:-1]:
        cursor = cursor.setdefault(part, {})
    cursor[parts[-1]] = value


def extract(text: str) -> dict[str, Any]:
    cleaned = text or ""
    aliases = get_aliases_for("Bank_Statements")
    schema = set(_schema_fields())

    start_date, end_date = _extract_statement_period(
        cleaned,
        aliases.get("statement_period.start", []),
        aliases.get("statement_period.end", []),
    )

    extracted: Dict[str, Any] = {}

    def maybe_assign(field: str, value: Any) -> None:
        if field not in schema:
            return
        if value is None:
            return
        if isinstance(value, str) and not value.strip():
            return
        _assign_field(extracted, field, value)

    maybe_assign("bank_name", _extract_text_field(cleaned, aliases.get("bank_name", [])))
    maybe_assign(
        "account_holder_name",
        _extract_text_field(cleaned, aliases.get("account_holder_name", [])),
    )
    maybe_assign(
        "account_number_last4",
        _extract_account_last4(cleaned, aliases.get("account_number_last4", [])),
    )
    maybe_assign("statement_period.start", start_date)
    maybe_assign("statement_period.end", end_date)
    maybe_assign(
        "beginning_balance",
        _extract_numeric_field(cleaned, aliases.get("beginning_balance", [])),
    )
    maybe_assign(
        "ending_balance",
        _extract_numeric_field(cleaned, aliases.get("ending_balance", [])),
    )
    maybe_assign(
        "totals.deposits",
        _extract_numeric_field(cleaned, aliases.get("totals.deposits", [])),
    )
    maybe_assign(
        "totals.withdrawals",
        _extract_numeric_field(cleaned, aliases.get("totals.withdrawals", [])),
    )
    maybe_assign("currency", _extract_currency(cleaned, aliases.get("currency", [])))

    return extracted


__all__ = ["extract"]
