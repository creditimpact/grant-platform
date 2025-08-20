from __future__ import annotations
from copy import deepcopy
from typing import Any, Dict, Tuple, List


EMPTY_VALUES = {None, "", [], {}, ()}


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
        if key not in merged or merged[key] in EMPTY_VALUES:
            merged[key] = value
            steps.append(f'filled "{key}" from inference')
        else:
            steps.append(f'kept user value for "{key}"')
    return merged, steps
