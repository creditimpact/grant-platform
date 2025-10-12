"""OCR utilities for document parsing."""

from __future__ import annotations

import io
import json
import os
import tempfile
from pathlib import Path
from typing import Any, Iterable, Optional, Sequence


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

try:  # pragma: no cover - external dependency may be missing
    from pdfminer.high_level import extract_pages  # type: ignore
    from pdfminer.layout import LTChar, LTTextContainer, LTTextLine  # type: ignore
except Exception:  # pragma: no cover - gracefully handle missing libs
    extract_pages = None  # type: ignore
    LTChar = None  # type: ignore
    LTTextContainer = None  # type: ignore
    LTTextLine = None  # type: ignore


def _average_font_size(characters: Sequence[Any]) -> Optional[float]:
    sizes = [char.size for char in characters if isinstance(char, LTChar)] if LTChar else []
    if not sizes:
        return None
    return sum(sizes) / len(sizes)


def _build_page_payload(
    page_number: int,
    lines: Iterable[dict[str, Any]],
) -> dict[str, Any]:
    line_entries = [line for line in lines if line.get("text")]
    raw_text = "\n".join(entry["text"] for entry in line_entries)
    return {
        "page": page_number,
        "lines": line_entries,
        "raw_text": raw_text,
    }


def build_structured_from_text(text: str) -> dict[str, Any]:
    """Create a minimal structured payload from plain text input."""

    normalized = text.strip()
    lines = [
        {"text": line.strip()}
        for line in normalized.splitlines()
        if line.strip()
    ]
    return {
        "pages": [
            {
                "page": 1,
                "lines": lines,
                "raw_text": "\n".join(line["text"] for line in lines),
            }
        ]
        if normalized
        else []
    }


def extract_text_as_json(pdf_path: str) -> dict[str, Any]:
    """Extract structured text with layout metadata using ``pdfminer.six``."""

    if not extract_pages or not LTTextContainer:
        raise OCRExtractionError("pdfminer.six is not available")

    pages_data: list[dict[str, Any]] = []
    for page_number, layout in enumerate(extract_pages(pdf_path), start=1):
        line_entries: list[dict[str, Any]] = []
        for element in layout:
            if not isinstance(element, LTTextContainer):
                continue
            for text_line in element:
                if LTTextLine is not None and not isinstance(text_line, LTTextLine):
                    # Some containers yield non-text line objects; skip them.
                    continue
                if not hasattr(text_line, "get_text"):
                    continue
                line_text = text_line.get_text().strip()
                if not line_text:
                    continue
                bbox = [
                    float(text_line.x0),
                    float(text_line.y0),
                    float(text_line.x1),
                    float(text_line.y1),
                ]
                characters = getattr(text_line, "_objs", [])
                avg_font_size = _average_font_size(characters) if characters else None
                entry: dict[str, Any] = {
                    "text": line_text,
                    "bbox": bbox,
                }
                if avg_font_size is not None:
                    entry["font_size"] = avg_font_size
                entry["confidence"] = 1.0
                line_entries.append(entry)
        pages_data.append(_build_page_payload(page_number, line_entries))

    return {"pages": pages_data}


def _json_from_page_texts(pages_text: Iterable[str]) -> dict[str, Any]:
    pages: list[dict[str, Any]] = []
    for page_number, page_text in enumerate(pages_text, start=1):
        normalized_lines = [line.strip() for line in page_text.splitlines() if line.strip()]
        line_entries = [{"text": line} for line in normalized_lines]
        pages.append(_build_page_payload(page_number, line_entries))
    return {"pages": pages}


def _combine_raw_text(structured: dict[str, Any]) -> str:
    pages = structured.get("pages", []) if isinstance(structured, dict) else []
    texts = [page.get("raw_text", "") for page in pages if page.get("raw_text")]
    combined = "\n".join(texts).strip()
    return combined


def extract_text_with_metadata(file_bytes: bytes) -> tuple[str, dict[str, Any]]:
    """Return extracted text alongside structured JSON metadata."""

    if not file_bytes:
        return "", {"pages": []}

    structured: dict[str, Any] | None = None

    if file_bytes.lstrip()[:4] == b"%PDF":
        if extract_pages:
            tmp_path: str | None = None
            try:
                with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
                    tmp.write(file_bytes)
                    tmp_path = tmp.name
                if tmp_path:
                    structured = extract_text_as_json(tmp_path)
            except Exception:
                structured = None
            finally:
                if tmp_path and Path(tmp_path).exists():
                    try:
                        os.unlink(tmp_path)
                    except OSError:
                        pass
        if structured is None and pdfplumber:
            try:  # pragma: no cover - depends on external library
                with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
                    page_texts = [page.extract_text() or "" for page in pdf.pages]
                structured = _json_from_page_texts(page_texts)
            except Exception:
                structured = None
        if structured is None and pytesseract and convert_from_bytes:
            try:  # pragma: no cover - relies on external binaries
                pages = convert_from_bytes(file_bytes)
                page_texts = [pytesseract.image_to_string(page) for page in pages]
                structured = _json_from_page_texts(page_texts)
            except Exception:
                structured = None

    if structured is None and pytesseract and Image:
        try:  # pragma: no cover - relies on external binaries
            image = Image.open(io.BytesIO(file_bytes))
            structured = _json_from_page_texts([pytesseract.image_to_string(image)])
        except Exception:
            structured = None

    if structured is None:
        try:
            decoded = file_bytes.decode("utf-8", errors="ignore")
            structured = build_structured_from_text(decoded)
        except Exception:
            structured = {"pages": []}

    text = _combine_raw_text(structured)
    if text:
        print(f"OCR extracted {len(text)} characters")
    return text, structured


def extract_text(file_bytes: bytes) -> str:
    """Return extracted text while preserving backward compatibility."""

    text, _ = extract_text_with_metadata(file_bytes)
    return text


def export_structured_json(structured: dict[str, Any], path: Path) -> None:
    """Persist structured OCR data to the provided path."""

    with path.open("w", encoding="utf-8") as handle:
        json.dump(structured, handle, ensure_ascii=False, indent=2)

