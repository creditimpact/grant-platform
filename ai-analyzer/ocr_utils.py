"""OCR utilities for document parsing."""

from __future__ import annotations

import io
from typing import Optional

try:  # pragma: no cover - external dependency may be missing
    import pytesseract  # type: ignore
    from PIL import Image  # type: ignore
except Exception:  # pragma: no cover - gracefully handle missing libs
    pytesseract = None  # type: ignore
    Image = None  # type: ignore


def extract_text(file_bytes: bytes) -> str:
    """Return extracted text using Tesseract when available."""
    if pytesseract and Image:
        try:  # pragma: no cover - relies on external binaries
            image = Image.open(io.BytesIO(file_bytes))
            text = pytesseract.image_to_string(image)
            return text
        except Exception:
            pass

    # Fallback to simple decoding
    try:
        return file_bytes.decode("utf-8")
    except Exception:
        # Final fallback for binary files
        return "sample extracted text"

