"""Utility helpers for document parsing and lookup."""

from typing import Dict, Any
from pathlib import Path
import re

from nlp_utils import normalize_text_field, infer_field_from_text

DOCUMENTS_DIR = Path(__file__).parent / "test_documents"


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


def guess_attachment(field_name: str) -> str | None:
    """Return path to a test document matching ``field_name`` if found."""
    name = field_name.lower()
    patterns = {
        "tax": "fake_tz.pdf",
        "paystub": "paystub_example.jpg",
        "id": "id_card.jpg",
        "registration": "registration.pdf",
    }
    for key, filename in patterns.items():
        if key in name:
            path = DOCUMENTS_DIR / filename
            if path.exists():
                return str(path)
    # fallback: first file containing the field name
    for path in DOCUMENTS_DIR.iterdir():
        if name in path.stem:
            return str(path)
    return None
