"""Utility functions for simple OCR-based field extraction."""
from typing import Dict


def extract_fields(file_bytes: bytes) -> Dict[str, str]:
    """Parse key:value lines from a text-based document.

    This is a lightweight placeholder for real OCR using pytesseract and
    pdfplumber. Documents in ``test_documents`` are simple text files so we
    just decode them and split on colons.
    """
    try:
        text = file_bytes.decode("utf-8")
    except UnicodeDecodeError:
        text = ""
    fields: Dict[str, str] = {}
    for line in text.splitlines():
        if ":" in line:
            key, value = line.split(":", 1)
            fields[key.strip()] = value.strip()
    return fields
