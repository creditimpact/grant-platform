"""Very small NLP helper for field extraction."""

from __future__ import annotations

import re
from typing import Dict, Tuple


_FIELD_PATTERNS = {
    "revenue": re.compile(r"revenue\s*[:\-\$]?\s*([\d,]+)", re.I),
    "employees": re.compile(r"(\d+)\s+employees", re.I),
    "year_founded": re.compile(r"(\d{4})"),
}


def parse_fields(text: str) -> Tuple[Dict[str, str | int], Dict[str, float]]:
    """Return structured fields and a simple confidence score."""
    fields: Dict[str, str | int] = {}
    confidence: Dict[str, float] = {}
    if not text:
        return fields, confidence

    for name, pattern in _FIELD_PATTERNS.items():
        m = pattern.search(text)
        if m:
            val = m.group(1)
            if name in {"revenue", "employees"}:
                val = int(val.replace(",", ""))
            fields[name] = val
            confidence[name] = 0.9

    return fields, confidence
