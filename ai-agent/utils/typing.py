from __future__ import annotations
from typing import Any
import re


BOOL_TRUE = {"1", "true", "yes", "y", "on"}
BOOL_FALSE = {"0", "false", "no", "n", "off"}


def coerce_bool(val: Any) -> bool | Any:
    if isinstance(val, bool):
        return val
    if isinstance(val, str):
        lowered = val.strip().lower()
        if lowered in BOOL_TRUE:
            return True
        if lowered in BOOL_FALSE:
            return False
    return val


PERCENT_RE = re.compile(r"^\s*(\d+(?:\.\d+)?)\s*%\s*$")


def coerce_percent(val: Any) -> float | Any:
    if isinstance(val, (int, float)):
        return float(val)
    if isinstance(val, str):
        m = PERCENT_RE.match(val)
        if m:
            return float(m.group(1))
    return val


CURRENCY_RE = re.compile(r"^\$?([0-9][0-9,]*)(?:\.(\d{2}))?$")


def coerce_currency(val: Any) -> int | float | Any:
    if isinstance(val, (int, float)):
        return val
    if isinstance(val, str):
        m = CURRENCY_RE.match(val.replace(",", ""))
        if m:
            whole = int(m.group(1))
            cents = m.group(2)
            if cents:
                return whole + int(cents) / 100
            return whole
    return val
