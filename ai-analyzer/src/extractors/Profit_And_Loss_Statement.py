from __future__ import annotations

import re
from datetime import datetime
from typing import Any, Dict, Iterable, Optional, Tuple

from document_library import catalog_index
from document_library.aliases import get_aliases_for

DATE_RANGE = re.compile(
    r"(?:For the|For)\s+(?:period|year|quarter)\s+(.*?)(?:-|to)\s+(.*)",
    re.IGNORECASE,
)
AMOUNT_PATTERN = r"[-+]?\$?\s?\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?"


def _schema_fields() -> Tuple[str, ...]:
    definition = catalog_index().get("Profit_And_Loss_Statement")
    return definition.schema_fields if definition else ()


def _parse_date(value: str) -> Optional[str]:
    for fmt in ("%b %d, %Y", "%B %d, %Y", "%m/%d/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(value.strip(), fmt).date().isoformat()
        except Exception:
            continue
    return None


def _format_amount(raw: Optional[str]) -> Optional[str]:
    if raw is None:
        return None
    cleaned = raw.replace("$", "").replace(",", "").strip()
    return cleaned or None


def _extract_amount(text: str, aliases: Iterable[str]) -> Optional[str]:
    for alias in aliases:
        pattern = re.compile(rf"(?:{alias}).*?({AMOUNT_PATTERN})", re.IGNORECASE)
        match = pattern.search(text)
        if match:
            formatted = _format_amount(match.group(1))
            if formatted is not None:
                return formatted
    return None


def _detect_currency(text: str) -> Optional[str]:
    match = re.search(r"\b(USD|EUR|GBP|CAD|AUD)\b", text, re.IGNORECASE)
    if match:
        return match.group(1).upper()
    if "$" in text:
        return "USD"
    return None


def extract(text: str) -> dict[str, Any]:
    cleaned = text or ""
    aliases = get_aliases_for("Profit_And_Loss_Statement")
    schema = set(_schema_fields())

    extracted: Dict[str, Any] = {}

    def maybe_assign(field: str, value: Any) -> None:
        if field not in schema:
            return
        if value is None:
            return
        if isinstance(value, str) and not value.strip():
            return
        parts = field.split(".")
        cursor: Dict[str, Any] = extracted
        for part in parts[:-1]:
            cursor = cursor.setdefault(part, {})
        cursor[parts[-1]] = value

    period_start = period_end = None
    match = DATE_RANGE.search(cleaned)
    if match:
        period_start = _parse_date(match.group(1))
        period_end = _parse_date(match.group(2))

    maybe_assign("period_start", period_start)
    maybe_assign("period_end", period_end)

    maybe_assign(
        "total_revenue",
        _extract_amount(cleaned, aliases.get("total_revenue", ["total revenue", "revenue", "sales"])),
    )
    maybe_assign(
        "cogs",
        _extract_amount(
            cleaned,
            aliases.get("cogs", ["cost of goods sold", "cogs"]),
        ),
    )
    maybe_assign(
        "gross_profit",
        _extract_amount(cleaned, aliases.get("gross_profit", ["gross profit"])),
    )
    maybe_assign(
        "total_expenses",
        _extract_amount(cleaned, aliases.get("total_expenses", ["total expenses"])),
    )
    maybe_assign(
        "net_income",
        _extract_amount(
            cleaned,
            aliases.get("net_income", ["net income", "net profit", "loss"]),
        ),
    )

    maybe_assign("currency", _detect_currency(cleaned))

    return extracted


__all__ = ["extract"]
