"""Utilities for working with the shared document catalog."""
from __future__ import annotations

from dataclasses import dataclass, field
from functools import lru_cache
import json
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

BASE_DIR = Path(__file__).resolve().parent
CATALOG_PATH = BASE_DIR / "catalog.json"
ALIAS_PATH = BASE_DIR / "aliases.json"


@dataclass(frozen=True)
class DetectorSpec:
    """Detection rules associated with a document definition."""

    filename_contains: Tuple[str, ...] = ()
    text_contains: Tuple[str, ...] = ()
    text_regex: Tuple[str, ...] = ()
    page_hints: Tuple[int, ...] = ()
    score_bonus: float = 0.0
    extras: Dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, data: Optional[Dict[str, Any]]) -> "DetectorSpec":
        data = data or {}
        extras_keys = set(data.keys()) - {
            "filename_contains",
            "text_contains",
            "text_regex",
            "page_hints",
            "score_bonus",
        }
        extras = {key: data[key] for key in extras_keys}
        return cls(
            filename_contains=tuple(str(item) for item in data.get("filename_contains", []) if item),
            text_contains=tuple(str(item) for item in data.get("text_contains", []) if item),
            text_regex=tuple(str(item) for item in data.get("text_regex", []) if item),
            page_hints=tuple(int(item) for item in data.get("page_hints", []) if item is not None),
            score_bonus=float(data.get("score_bonus", 0.0) or 0.0),
            extras=extras,
        )


@dataclass(frozen=True)
class DocumentDefinition:
    """Structured representation of a single document in the catalog."""

    key: str
    display_name: str
    family: str
    core_level: str
    aliases: Tuple[str, ...] = ()
    used_in_grants: Tuple[str, ...] = ()
    schema_fields: Tuple[str, ...] = ()
    detector: DetectorSpec = field(default_factory=DetectorSpec)
    description: Optional[str] = None
    supported_formats: Tuple[str, ...] = ()
    metadata: Dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, payload: Dict[str, Any]) -> "DocumentDefinition":
        detector = DetectorSpec.from_dict(payload.get("detector"))
        return cls(
            key=str(payload["key"]),
            display_name=str(payload.get("display_name") or payload["key"]),
            family=str(payload.get("family") or "General"),
            core_level=str(payload.get("core_level") or "Supporting"),
            aliases=tuple(str(a) for a in payload.get("aliases", []) if a),
            used_in_grants=tuple(str(g) for g in payload.get("used_in_grants", []) if g),
            schema_fields=tuple(str(f) for f in payload.get("schema_fields", []) if f),
            detector=detector,
            description=payload.get("description"),
            supported_formats=tuple(str(fmt) for fmt in payload.get("supported_formats", []) if fmt),
            metadata={str(k): v for k, v in (payload.get("metadata") or {}).items()},
        )


def _load_catalog_json() -> Dict[str, Any]:
    raw = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    if "documents" not in raw:
        raise ValueError("catalog.json must contain a 'documents' array")
    return raw


@lru_cache(maxsize=1)
def load_catalog() -> List[DocumentDefinition]:
    """Load the full catalog as a list of :class:`DocumentDefinition`."""

    data = _load_catalog_json()
    return [DocumentDefinition.from_dict(entry) for entry in data.get("documents", [])]


@lru_cache(maxsize=1)
def catalog_index() -> Dict[str, DocumentDefinition]:
    """Index catalog entries by their canonical document key."""

    return {doc.key: doc for doc in load_catalog()}


@lru_cache(maxsize=1)
def load_alias_map() -> Dict[str, str]:
    """Return a lower-cased alias lookup table for document keys."""

    mapping: Dict[str, str] = {}
    if ALIAS_PATH.exists():
        alias_payload = json.loads(ALIAS_PATH.read_text(encoding="utf-8"))
        for alias, canonical in alias_payload.get("aliases", {}).items():
            mapping[str(alias).strip().lower()] = str(canonical)
    # Ensure canonical keys and embedded aliases resolve to themselves
    for doc in load_catalog():
        mapping.setdefault(doc.key.lower(), doc.key)
        for alias in doc.aliases:
            mapping.setdefault(alias.lower(), doc.key)
    return mapping


def normalize_key(key: Optional[str]) -> Optional[str]:
    """Normalize an arbitrary document key to its canonical value."""

    if key is None:
        return None
    value = str(key).strip()
    if not value:
        return value
    return load_alias_map().get(value.lower(), value)


def normalize_list(values: Optional[Iterable[str]]) -> List[str]:
    """Normalize and deduplicate a sequence of document keys."""

    if not values:
        return []
    seen: set[str] = set()
    out: List[str] = []
    for value in values:
        normalized = normalize_key(value)
        if normalized and normalized not in seen:
            seen.add(normalized)
            out.append(normalized)
    return out


def family_aliases() -> Dict[str, str]:
    """Return alias mappings for document family names."""

    if not ALIAS_PATH.exists():
        return {}
    payload = json.loads(ALIAS_PATH.read_text(encoding="utf-8"))
    return {
        str(alias).strip().lower(): str(family)
        for alias, family in (payload.get("family_aliases") or {}).items()
    }


__all__ = [
    "DocumentDefinition",
    "DetectorSpec",
    "catalog_index",
    "family_aliases",
    "load_alias_map",
    "load_catalog",
    "normalize_key",
    "normalize_list",
]
