from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path


@lru_cache(maxsize=1)
def _load_aliases() -> dict[str, str]:
    path = Path(__file__).resolve().parents[2] / "shared" / "normalization" / "document_aliases.json"
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {}
    aliases = data.get("aliases", {})
    return {str(key).strip().lower(): str(value) for key, value in aliases.items()}


def normalize_doc_type(key: str | None) -> str | None:
    if key is None:
        return None
    stripped = str(key).strip()
    if not stripped:
        return stripped
    aliases = _load_aliases()
    return aliases.get(stripped.lower(), stripped)
