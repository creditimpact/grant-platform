import json
import re
from datetime import datetime
from pathlib import Path
from typing import Dict, Any

from industry_classifier import assign_industry_naics

FIELD_MAP_PATH = Path(__file__).resolve().parent.parent / "contracts" / "field_map.json"


def load_field_map(path: Path = FIELD_MAP_PATH) -> Dict[str, Any]:
    with path.open() as f:
        return json.load(f)


def normalize_payload(analyzer_payload: Dict[str, Any]) -> Dict[str, Any]:
    field_map = load_field_map()
    data = fill_aliases(analyzer_payload, field_map)
    data = coerce_types_and_units(data, field_map)
    data = assign_industry_naics(data)
    return data


def fill_aliases(payload: Dict[str, Any], field_map: Dict[str, Any]) -> Dict[str, Any]:
    """Map all known aliases to their canonical targets.

    The field map now defines each canonical field once and lists any
    acceptable aliases. This helper builds a reverse lookup so payload keys
    produced by the analyzer or UI are rewritten to the canonical key.
    """

    alias_map: Dict[str, str] = {}
    for target, info in field_map.items():
        alias_map[target] = target
        for alias in info.get("aliases", []):
            alias_map[alias] = target

    result: Dict[str, Any] = {}
    for key, value in payload.items():
        target = alias_map.get(key, key)
        result[target] = value
    return result


def coerce_types_and_units(payload: Dict[str, Any], field_map: Dict[str, Any]) -> Dict[str, Any]:
    """Coerce values to the types declared in the field map."""

    result: Dict[str, Any] = {}
    for key, value in payload.items():
        info = field_map.get(key, {})
        result[key] = _coerce_value(value, info, key)
    return result


def _coerce_value(value: Any, info: Dict[str, Any], key: str) -> Any:
    if value is None:
        return None
    v = value
    t = info.get("type")
    if t == "int":
        if isinstance(v, str):
            v = re.sub(r"[^0-9-]", "", v)
        try:
            return int(v)
        except ValueError:
            return v
    if t == "currency":
        if isinstance(v, str):
            s = v.strip().lower().replace("$", "").replace(",", "")
            if s.startswith("(") and s.endswith(")"):
                s = s[1:-1]
            multiplier = 1
            if s.endswith("m"):
                multiplier = 1_000_000
                s = s[:-1]
            elif s.endswith("k"):
                multiplier = 1_000
                s = s[:-1]
            try:
                return int(float(s) * multiplier)
            except ValueError:
                return 0
        try:
            return int(float(v))
        except (ValueError, TypeError):
            return 0
    if t == "percent":
        if isinstance(v, str):
            v = v.strip()
            if v.endswith("%"):
                v = v[:-1]
            v = v.replace(",", "")
        try:
            v = float(v)
            if v <= 1:
                v *= 100
            return float(v)
        except ValueError:
            return 0.0
    if t == "bool":
        if isinstance(v, str):
            return v.lower() in {"true", "yes", "y", "1"}
        return bool(v)
    if t == "date":
        if isinstance(v, str):
            for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y"):
                try:
                    return datetime.strptime(v, fmt).strftime("%Y-%m-%d")
                except ValueError:
                    continue
        return v
    if t == "ein" or key == "employer_identification_number":
        if isinstance(v, str):
            digits = re.sub(r"[^0-9]", "", v)
            if len(digits) == 9:
                return f"{digits[:2]}-{digits[2:]}"
            return digits
    return v
