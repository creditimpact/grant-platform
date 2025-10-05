from __future__ import annotations

import re
from datetime import datetime
from typing import Any, Dict, Optional, Tuple

from document_library import catalog_index
from document_library.aliases import get_aliases_for


def _schema_fields() -> Tuple[str, ...]:
    definition = catalog_index().get("Business_License")
    return definition.schema_fields if definition else ()


def _normalize_date(value: str) -> Optional[str]:
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%m-%d-%Y"):
        try:
            return datetime.strptime(value.strip(), fmt).date().isoformat()
        except ValueError:
            continue
    return value.strip() or None


def _extract_with_aliases(text: str, field_aliases: list[str]) -> Optional[str]:
    for label in field_aliases:
        pattern = re.compile(rf"{re.escape(label)}\s*[:\-]?\s*(.+)", re.IGNORECASE)
        match = pattern.search(text)
        if match:
            candidate = match.group(1).strip()
            if candidate:
                return candidate
    return None


def extract(text: str) -> dict[str, Any]:
    cleaned = text or ""
    aliases = get_aliases_for("Business_License")
    schema = set(_schema_fields())

    extracted: Dict[str, Any] = {}

    def maybe_assign(field: str, value: Optional[str]) -> None:
        if field not in schema:
            return
        if value is None:
            return
        if isinstance(value, str) and not value.strip():
            return
        extracted[field] = value

    maybe_assign(
        "applicant_name",
        _extract_with_aliases(cleaned, aliases.get("applicant_name", ["Applicant Name"])),
    )
    dob = _extract_with_aliases(cleaned, aliases.get("date_of_birth", ["Date of Birth"]))
    maybe_assign("date_of_birth", _normalize_date(dob) if dob else None)
    maybe_assign(
        "home_address",
        _extract_with_aliases(cleaned, aliases.get("home_address", ["Home Address"])),
    )
    maybe_assign(
        "business_name",
        _extract_with_aliases(cleaned, aliases.get("business_name", ["Business Name"])),
    )
    maybe_assign(
        "business_address",
        _extract_with_aliases(cleaned, aliases.get("business_address", ["Business Address"])),
    )
    maybe_assign(
        "type_of_business",
        _extract_with_aliases(cleaned, aliases.get("type_of_business", ["Type of Business"])),
    )

    return extracted


__all__ = ["extract"]
