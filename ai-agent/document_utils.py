"""Utility functions for simple OCR-based field extraction."""
from typing import Dict, Any
import re

from nlp_utils import normalize_text_field, infer_field_from_text


def extract_fields(file_bytes: bytes) -> Dict[str, Any]:
    """Parse key:value lines from a text-based document and infer additional fields."""
    try:
        text = file_bytes.decode("utf-8")
    except UnicodeDecodeError:
        text = ""

    fields: Dict[str, Any] = {}

    for line in text.splitlines():
        if ":" in line:
            key, value = line.split(":", 1)
            k, v = normalize_text_field(key.strip(), value.strip())
            fields[k] = v

    # known patterns
    id_match = re.search(r"\b\d{9}\b", text)
    if id_match:
        fields.setdefault("id_number", id_match.group())

    ein_match = re.search(r"\b\d{2}-\d{7}\b", text)
    if ein_match:
        fields.setdefault("ein", ein_match.group())

    income_match = re.search(r"net income\s*[:\-]?\s*(\$?\d+[\d,]*)", text, re.I)
    if income_match:
        fields.setdefault("net_income", income_match.group(1))

    fields.update(infer_field_from_text(text))

    return fields
