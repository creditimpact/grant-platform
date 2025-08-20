import io

import pytest
import env_setup  # noqa: F401
from fastapi.testclient import TestClient
import io

import pytest
import env_setup  # noqa: F401
from fastapi.testclient import TestClient

from main import app


client = TestClient(app)


def test_analyze_json_happy_path() -> None:
    resp = client.post(
        "/analyze",
        json={
            "text": "EIN 12-3456789; W-2 employees: 10; Q1 2023 revenue $120k; LLC",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["ein"] == "12-3456789"
    assert data["w2_employee_count"] == 10
    assert data["quarterly_revenues"]["2023"]["Q1"] == 120000
    assert data["entity_type"] == "llc"
    assert data["source"] == "text"


def test_analyze_text_plain_happy_path() -> None:
    headers = {"Content-Type": "text/plain"}
    resp = client.post(
        "/analyze",
        data="Founded 2019\nW-2 employees: 25",
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["year_founded"] == 2019
    assert data["w2_employee_count"] == 25


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
        return "Q1 2023 revenue $5000; EIN 11-1111111"

    monkeypatch.setattr("ocr_utils.extract_text", mock_extract_text)

    file_content = io.BytesIO(b"dummy")
    resp = client.post(
        "/analyze",
        files={"file": ("test.png", file_content, "image/png")},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["quarterly_revenues"]["2023"]["Q1"] == 5000
    assert data["ein"] == "11-1111111"
    assert data["source"] == "file"


def test_analyze_multipart_invalid_type() -> None:
    file_content = io.BytesIO(b"dummy")
    resp = client.post(
        "/analyze",
        files={"file": ("test.exe", file_content, "application/octet-stream")},
    )
    assert resp.status_code == 400
    assert resp.json()["error"].startswith("Invalid file type")


def test_analyze_multipart_file_too_large() -> None:
    big_content = io.BytesIO(b"a" * (5 * 1024 * 1024 + 1))
    resp = client.post(
        "/analyze",
        files={"file": ("big.png", big_content, "image/png")},
    )
    assert resp.status_code == 400
    assert resp.json()["error"] == "File too large. Maximum allowed size is 5MB."

