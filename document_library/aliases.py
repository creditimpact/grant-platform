"""Helpers for working with document field aliases."""
from __future__ import annotations

import json
from functools import lru_cache
from typing import Dict, Iterable, List

from . import ALIAS_PATH, catalog_index


def _dedupe(values: Iterable[str]) -> List[str]:
    seen: set[str] = set()
    ordered: List[str] = []
    for value in values:
        if value is None:
            continue
        text = str(value).strip()
        if not text:
            continue
        lowered = text.lower()
        if lowered in seen:
            continue
        seen.add(lowered)
        ordered.append(text)
    return ordered


def _default_alias(field_name: str) -> str | None:
    if not field_name:
        return None
    parts = field_name.split(".")
    if len(parts) == 1:
        base = parts[0]
    else:
        base = f"{parts[-2]} {parts[-1]}"
    label = base.replace("_", " ").strip()
    if not label:
        return None
    return " ".join(word.capitalize() for word in label.split())


@lru_cache(maxsize=1)
def _load_field_alias_payload() -> Dict[str, Dict[str, List[str]]]:
    if not ALIAS_PATH.exists():
        return {}
    data = json.loads(ALIAS_PATH.read_text(encoding="utf-8"))
    raw_field_aliases = data.get("field_aliases") or {}
    normalized: Dict[str, Dict[str, List[str]]] = {}
    for doc_key, mapping in raw_field_aliases.items():
        field_map: Dict[str, List[str]] = {}
        for field_name, aliases in (mapping or {}).items():
            field_map[str(field_name)] = _dedupe(aliases or [])
        normalized[str(doc_key)] = field_map
    return normalized


def get_aliases_for(doc_key: str | None) -> Dict[str, List[str]]:
    """Return field alias lists for the requested document key."""

    if not doc_key:
        return {}
    document_key = str(doc_key)
    payload = _load_field_alias_payload()
    doc_aliases = dict(payload.get(document_key, {}))

    definition = catalog_index().get(document_key)
    if definition:
        for field_name in definition.schema_fields:
            doc_aliases.setdefault(field_name, [])

    for field_name, aliases in list(doc_aliases.items()):
        default = _default_alias(field_name)
        if default:
            aliases = [default, *aliases]
        doc_aliases[field_name] = _dedupe(aliases)

    return doc_aliases


__all__ = ["get_aliases_for"]

