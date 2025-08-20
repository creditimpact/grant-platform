import io

import pytest
import env_setup  # noqa: F401
from fastapi.testclient import TestClient

from main import app


client = TestClient(app)


def _patch_ocr(monkeypatch: pytest.MonkeyPatch) -> None:
    class DummyPytesseract:
        @staticmethod
        def image_to_string(_: object) -> str:
            return "text"

    class DummyImage:
        @staticmethod
        def open(_: io.BytesIO) -> object:  # pragma: no cover - simple stub
            return object()

    monkeypatch.setattr("main.pytesseract", DummyPytesseract)
    monkeypatch.setattr("main.Image", DummyImage)


def test_ocr_image_valid(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_ocr(monkeypatch)
    resp = client.post(
        "/ocr-image",
        files={"file": ("test.png", io.BytesIO(b"dummy"), "image/png")},
    )
    assert resp.status_code == 200
    assert "text" in resp.json()


def test_ocr_image_invalid_type() -> None:
    resp = client.post(
        "/ocr-image",
        files={"file": ("test.exe", io.BytesIO(b"dummy"), "application/octet-stream")},
    )
    assert resp.status_code == 400
    assert resp.json()["error"].startswith("Invalid file type")


def test_ocr_image_file_too_large() -> None:
    big_content = io.BytesIO(b"a" * (5 * 1024 * 1024 + 1))
    resp = client.post(
        "/ocr-image",
        files={"file": ("big.png", big_content, "image/png")},
    )
    assert resp.status_code == 400
    assert resp.json()["error"] == "File too large. Maximum allowed size is 5MB."

