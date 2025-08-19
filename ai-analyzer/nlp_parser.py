"""Text normalization and field extraction helpers."""

from __future__ import annotations

import re
from datetime import datetime
from typing import Dict, Tuple


def normalize_text(text: str) -> str:
    """Return text with collapsed whitespace and printable characters only."""
    if not text:
        return ""
    # remove non-printable characters
    text = "".join(ch for ch in text if ch.isprintable())
    # collapse whitespace
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _parse_number(value: str) -> int:
    """Parse a human-friendly number string to int."""
    value = value.lower().replace(",", "").replace("$", "").strip()
    multiplier = 1
    if value.endswith("m"):
        multiplier = 1_000_000
        value = value[:-1]
    elif value.endswith("k"):
        multiplier = 1_000
        value = value[:-1]
    try:
        return int(float(value) * multiplier)
    except ValueError:
        match = re.search(r"\d+", value)
        return int(match.group()) if match else 0


_FIELD_PATTERNS = {
    "ein": re.compile(r"\b(\d{2}-\d{7})\b"),
    "employees": re.compile(r"(?i)\b(?:employees?|staff)\b\D{0,30}?(\d{1,5})"),
    "revenue": re.compile(r"(?i)(?:revenue|gross receipts|sales)\b\D{0,30}?([\$0-9,\.]+[mk]?)"),
    "year_founded": re.compile(r"(?i)(?:founded|since)\b\D{0,10}?(\d{4})"),
}


def extract_fields(text: str) -> Tuple[Dict[str, str | int], Dict[str, float]]:
    """Return structured fields and a simple confidence score."""
    fields: Dict[str, str | int] = {}
    confidence: Dict[str, float] = {}
    if not text:
        return fields, confidence

    for name, pattern in _FIELD_PATTERNS.items():
        match = pattern.search(text)
        if not match:
            continue
        raw = match.group(1)
        if name in {"revenue", "employees"}:
            value = _parse_number(raw)
        elif name == "year_founded":
            year = int(raw)
            current = datetime.now().year
            if 1900 <= year <= current:
                value = year
            else:
                continue
        else:
            value = raw
        fields[name] = value
        confidence[name] = 0.9

    return fields, confidence


# Backwards compatibility for older imports
parse_fields = extract_fields

