from __future__ import annotations
from copy import deepcopy
from typing import Any, Dict, Tuple, List


def is_empty(value: Any) -> bool:
    """Return ``True`` if ``value`` should be considered empty.

    ``None`` and ``""`` are treated as empty, as well as any empty iterable or
    mapping such as ``list``, ``tuple``, ``set`` or ``dict``. This mirrors the
    behaviour expected by :func:`merge_preserving_user` without relying on
    unhashable types inside a set at import time.
    """

    if value is None or value == "":
        return True
    if isinstance(value, (list, tuple, set, frozenset, dict)) and len(value) == 0:
        return True
    return False


def merge_preserving_user(
    user_payload: Dict[str, Any], inferred: Dict[str, Any]
) -> Tuple[Dict[str, Any], List[str]]:
    """Merge ``inferred`` into ``user_payload`` without overwriting user values.

    Returns a tuple of the merged mapping and reasoning steps describing which
    fields were filled from inference versus which user values were kept.
    """

    merged = deepcopy(user_payload)
    steps: List[str] = []
    for key, value in inferred.items():
        if key not in merged or is_empty(merged[key]):
            merged[key] = value
            steps.append(f'filled "{key}" from inference')
        else:
            steps.append(f'kept user value for "{key}"')
    return merged, steps
