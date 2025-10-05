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

try:  # pragma: no cover - external dependency may be missing
    from pdf2image import convert_from_bytes  # type: ignore
except Exception:  # pragma: no cover - gracefully handle missing libs
    convert_from_bytes = None  # type: ignore


def extract_text(file_bytes: bytes) -> str:
    """Return extracted text using PDF or image OCR when available."""
    if pdfplumber and file_bytes.lstrip()[:4] == b"%PDF":
        try:  # pragma: no cover - depends on external library
            with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
                text = "\n".join(page.extract_text() or "" for page in pdf.pages)
            if text.strip():
                text = text.strip()
                print(f"OCR extracted {len(text)} characters")
                return text
        except Exception:
            pass

    if pytesseract and convert_from_bytes and file_bytes.lstrip()[:4] == b"%PDF":
        try:  # pragma: no cover - relies on external binaries
            pages = convert_from_bytes(file_bytes)
            text_chunks = []
            for page in pages:
                page_text = pytesseract.image_to_string(page)
                if page_text:
                    text_chunks.append(page_text)
            text = "\n".join(text_chunks).strip()
            if text:
                print(f"OCR extracted {len(text)} characters")
                return text
        except Exception:
            pass

    if pytesseract and Image:
        try:  # pragma: no cover - relies on external binaries
            image = Image.open(io.BytesIO(file_bytes))
            text = pytesseract.image_to_string(image).strip()
            if text:
                print(f"OCR extracted {len(text)} characters")
                return text
        except Exception:
            pass

    try:
        text = file_bytes.decode("utf-8", errors="ignore").strip()
        if text:
            print(f"OCR extracted {len(text)} characters")
            return text
    except Exception:
        pass

    return ""

