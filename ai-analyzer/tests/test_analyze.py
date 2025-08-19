import io

import pytest
import env_setup  # noqa: F401
from fastapi.testclient import TestClient

from main import app


client = TestClient(app)


def test_analyze_json_happy_path() -> None:
    resp = client.post(
        "/analyze",
        json={"text": "Revenue 1000; 10 employees; EIN 12-3456789"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["revenue"] == 1000
    assert data["employees"] == 10
    assert data["ein"] == "12-3456789"
    assert data["source"] == "text"


def test_analyze_text_plain_happy_path() -> None:
    headers = {"Content-Type": "text/plain"}
    resp = client.post(
        "/analyze",
        data="Founded 2019\nEmployees: 25",
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["year_founded"] == 2019
    assert data["employees"] == 25


def test_analyze_text_empty() -> None:
    headers = {"Content-Type": "text/plain"}
    resp = client.post("/analyze", data="", headers=headers)
    assert resp.status_code == 400


def test_analyze_text_oversize() -> None:
    headers = {"Content-Type": "text/plain"}
    resp = client.post("/analyze", data="a" * 100_001, headers=headers)
    assert resp.status_code == 400


def test_analyze_multipart_file(monkeypatch: pytest.MonkeyPatch) -> None:
    def mock_extract_text(_: bytes) -> str:
        return "Revenue 5000"

    monkeypatch.setattr("ocr_utils.extract_text", mock_extract_text)

    file_content = io.BytesIO(b"dummy")
    resp = client.post(
        "/analyze",
        files={"file": ("test.png", file_content, "image/png")},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["revenue"] == 5000
    assert data["source"] == "file"

