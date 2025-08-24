"""OCR utilities for document parsing."""

from __future__ import annotations

import io
from typing import Optional


class OCRExtractionError(Exception):
    """Raised when OCR extraction fails."""

try:  # pragma: no cover - external dependency may be missing
    import pdfplumber  # type: ignore
except Exception:  # pragma: no cover - gracefully handle missing libs
    pdfplumber = None  # type: ignore

try:  # pragma: no cover - external dependency may be missing
    import pytesseract  # type: ignore
    from PIL import Image  # type: ignore
except Exception:  # pragma: no cover - gracefully handle missing libs
    pytesseract = None  # type: ignore
    Image = None  # type: ignore


def extract_text(file_bytes: bytes) -> str:
    """Return extracted text using PDF or image OCR when available.

    Raises:
        OCRExtractionError: If PDF or image OCR fails.
    """
    if pdfplumber and file_bytes.lstrip()[:4] == b"%PDF":
        try:  # pragma: no cover - depends on external library
            with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
                text = "\n".join(page.extract_text() or "" for page in pdf.pages)
            if text.strip():
                return text.strip()
        except Exception as exc:
            raise OCRExtractionError("Failed to extract text from PDF") from exc

    if pytesseract and Image:
        try:  # pragma: no cover - relies on external binaries
            image = Image.open(io.BytesIO(file_bytes))
            text = pytesseract.image_to_string(image)
            return text.strip()
        except Exception as exc:
            raise OCRExtractionError("Failed to extract text from image") from exc

    # Fallback to simple decoding
    try:
        return file_bytes.decode("utf-8", errors="ignore").strip()
    except Exception as exc:
        raise OCRExtractionError("Failed to decode content") from exc

