"""Utilities for managing per-request diagnostic session artifacts."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


class SessionManager:
    """Create and manage directories for diagnostic tracing sessions."""

    BASE_DIR = Path(__file__).resolve().parents[2] / "tmp" / "sessions"
    SUBFOLDERS = ("raw", "ocr", "detect", "analyze", "catalog", "report")

    @classmethod
    def create_session(cls) -> str:
        """Create a new session directory tree and return its identifier."""
        cls.BASE_DIR.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S_%f")
        session_id = f"session_{timestamp}"
        session_path = cls.BASE_DIR / session_id
        session_path.mkdir(parents=True, exist_ok=True)
        for sub in cls.SUBFOLDERS:
            (session_path / sub).mkdir(parents=True, exist_ok=True)
        return session_id

    @classmethod
    def get_session_path(cls, session_id: str) -> Path:
        """Return the filesystem path for a given session identifier."""
        return cls.BASE_DIR / session_id

    @classmethod
    def _ensure_subfolder(cls, session_id: str, subfolder: str) -> Path:
        if subfolder not in cls.SUBFOLDERS:
            (cls.BASE_DIR / session_id).mkdir(parents=True, exist_ok=True)
        target = cls.get_session_path(session_id) / subfolder
        target.mkdir(parents=True, exist_ok=True)
        return target

    @classmethod
    def save_json(cls, session_id: str, subfolder: str, filename: str, data: Any) -> Path:
        """Persist JSON-serializable ``data`` under the session tree."""
        target_dir = cls._ensure_subfolder(session_id, subfolder)
        path = target_dir / filename
        with path.open("w", encoding="utf-8") as fh:
            json.dump(data, fh, ensure_ascii=False, indent=2)
        return path

    @classmethod
    def save_text(cls, session_id: str, subfolder: str, filename: str, text: str) -> Path:
        """Persist plain text ``text`` under the session tree."""
        target_dir = cls._ensure_subfolder(session_id, subfolder)
        path = target_dir / filename
        with path.open("w", encoding="utf-8") as fh:
            fh.write(text)
        return path

    @classmethod
    def save_bytes(
        cls, session_id: str, subfolder: str, filename: str, payload: bytes
    ) -> Path:
        """Persist binary ``payload`` under the session tree."""
        target_dir = cls._ensure_subfolder(session_id, subfolder)
        path = target_dir / filename
        with path.open("wb") as fh:
            fh.write(payload)
        return path
