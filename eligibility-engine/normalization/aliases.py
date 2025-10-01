from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Iterable, List, Optional


@lru_cache(maxsize=1)
def _load_aliases() -> dict[str, str]:
    path = Path(__file__).resolve().parents[2] / "shared" / "normalization" / "document_aliases.json"
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {}
    return {str(k).strip().lower(): str(v) for k, v in data.get("aliases", {}).items()}


def normalize_key(key: Optional[str]) -> Optional[str]:
    if key is None:
        return None
    text = str(key).strip()
    if not text:
        return text
    aliases = _load_aliases()
    return aliases.get(text.lower(), text)


def normalize_list(values: Optional[Iterable[str]]) -> List[str]:
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
