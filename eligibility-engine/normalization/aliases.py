from __future__ import annotations

from typing import Iterable, List, Optional

from document_library import normalize_key as catalog_normalize_key, normalize_list as catalog_normalize_list


def normalize_key(key: Optional[str]) -> Optional[str]:
    return catalog_normalize_key(key)


def normalize_list(values: Optional[Iterable[str]]) -> List[str]:
    return catalog_normalize_list(values)
