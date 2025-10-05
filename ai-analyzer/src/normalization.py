from __future__ import annotations

from document_library import normalize_key


def normalize_doc_type(key: str | None) -> str | None:
    return normalize_key(key)
