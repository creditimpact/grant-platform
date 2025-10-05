"""Field extraction logic for bank statement documents."""
from __future__ import annotations

import re
from typing import Iterable, Tuple

from document_library.aliases import get_aliases_for

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


def extract_fields(text: str) -> dict:
    if not text:
        text = ""

    aliases = get_aliases_for("Bank_Statements")

    start_date, end_date = _extract_statement_period(
        text,
        aliases.get("statement_period.start", []),
        aliases.get("statement_period.end", []),
    )

    return {
        "bank_name": _extract_text_field(text, aliases.get("bank_name", [])),
        "account_holder_name": _extract_text_field(
            text, aliases.get("account_holder_name", [])
        ),
        "account_number_last4": _extract_account_last4(
            text, aliases.get("account_number_last4", [])
        ),
        "statement_period": {
            "start": start_date,
            "end": end_date,
        },
        "beginning_balance": _extract_numeric_field(
            text, aliases.get("beginning_balance", [])
        ),
        "ending_balance": _extract_numeric_field(
            text, aliases.get("ending_balance", [])
        ),
        "totals": {
            "deposits": _extract_numeric_field(
                text, aliases.get("totals.deposits", [])
            ),
            "withdrawals": _extract_numeric_field(
                text, aliases.get("totals.withdrawals", [])
            ),
        },
        "currency": _extract_currency(text, aliases.get("currency", [])),
    }


__all__ = ["extract_fields"]

