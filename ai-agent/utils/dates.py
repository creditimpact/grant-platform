from __future__ import annotations
import re
from typing import Any, Dict, Tuple, List

DATE_RE_ISO = re.compile(r"^(\d{4})-(\d{2})-(\d{2})$")
DATE_RE_SLASH = re.compile(r"^(\d{2})/(\d{2})/(\d{4})$")


def normalize_date(value: str | None) -> str | None:
    """Return ``value`` normalised to YYYY-MM-DD if possible.

    Supports ISO dates and two common slash-separated formats (dd/MM/YYYY and
    MM/DD/YYYY). If both day and month are ``<=12`` the function defaults to
    dd/MM unless ``PREFER_US_DATES`` env flag is set to interpret as MM/DD.
    """

    if not value or not isinstance(value, str):
        return None

    value = value.strip()
    m = DATE_RE_ISO.match(value)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"

    m = DATE_RE_SLASH.match(value)
    if not m:
        return None
    part1, part2, year = int(m.group(1)), int(m.group(2)), int(m.group(3))

    prefer_us = bool(int(__import__("os").getenv("PREFER_US_DATES", "0")))
    if part1 > 12:
        day, month = part1, part2
    elif part2 > 12:
        day, month = part2, part1
    else:
        if prefer_us:
            month, day = part1, part2
        else:
            day, month = part1, part2
    return f"{year:04d}-{month:02d}-{day:02d}"


def _normalize_mapping(d: Dict[str, Any], steps: List[str], path: str = "") -> Dict[str, Any]:
    result: Dict[str, Any] = {}
    for key, value in d.items():
        current_path = f"{path}.{key}" if path else key
        if isinstance(value, dict):
            result[key] = _normalize_mapping(value, steps, current_path)
            continue
        if isinstance(value, str) and ("date" in key.lower() or key.lower().endswith("_date")):
            norm = normalize_date(value)
            if norm:
                steps.append(f'normalized "{current_path}" from "{value}" to "{norm}"')
                result[key] = norm
                continue
        result[key] = value
    return result


def normalize_dates_in_mapping(data: Dict[str, Any]) -> Tuple[Dict[str, Any], List[str]]:
    """Walk ``data`` normalising any date-like values.

    Returns a tuple of the normalised mapping and reasoning steps describing the
    transformations performed.
    """

    steps: List[str] = []
    normalized = _normalize_mapping(data, steps)
    return normalized, steps
