"""Utilities for validating uploaded files."""

from __future__ import annotations

import os
import json
from pathlib import Path

from fastapi import HTTPException, UploadFile

from ai_analyzer.config import settings  # type: ignore


FILE_TYPES_PATH = Path(__file__).resolve().parents[1] / "shared" / "file_types.json"
with open(FILE_TYPES_PATH) as f:
    ALLOWED_EXTENSIONS = set(json.load(f)["extensions"])


def validate_upload(file: UploadFile) -> None:
    """Validate file extension and size of an upload.

    Raises:
        HTTPException: if the file type or size is invalid.
    """

    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        allowed = ", ".join(sorted(ALLOWED_EXTENSIONS))
        msg = f"Invalid file type. Supported formats are: {allowed}"
        raise HTTPException(status_code=400, detail=msg)

    file.file.seek(0, os.SEEK_END)
    size = file.file.tell()
    file.file.seek(0)
    max_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024
    if size > max_bytes:
        msg = f"File too large. Maximum allowed size is {settings.MAX_FILE_SIZE_MB}MB."
        raise HTTPException(status_code=400, detail=msg)

