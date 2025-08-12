import os
from importlib import reload
from fastapi import TestClient
from fastapi import HTTPException
import env_setup  # ENV VALIDATION: seed env vars


def get_client(monkeypatch, scan_behavior=None):
    import main as main_module
    reload(main_module)
    # Stub out heavy functions
    monkeypatch.setattr(main_module, "extract_text", lambda data: "")
    monkeypatch.setattr(main_module, "parse_fields", lambda text: ({}, {}))
    if scan_behavior is None:
        monkeypatch.setattr(main_module, "scan_for_viruses", lambda data: None)
    else:
        monkeypatch.setattr(main_module, "scan_for_viruses", scan_behavior)
    return TestClient(main_module.app)


def test_analyze_requires_api_key(monkeypatch):
    client = get_client(monkeypatch)
    files = {"file": ("doc.pdf", b"data", "application/pdf")}
    resp = client.post("/analyze", files=files)
    assert resp.status_code == 401
    resp = client.post("/analyze", files=files, headers={"X-API-Key": "test-key"})
    assert resp.status_code == 200


def test_file_too_large(monkeypatch):
    client = get_client(monkeypatch)
    big = b"0" * (5 * 1024 * 1024 + 1)
    files = {"file": ("big.pdf", big, "application/pdf")}
    resp = client.post("/analyze", files=files, headers={"X-API-Key": "test-key"})
    assert resp.status_code == 413


def test_detects_infected_file(monkeypatch):
    def fake_scan(_):
        raise HTTPException(status_code=400, detail="Virus detected")
    client = get_client(monkeypatch, scan_behavior=fake_scan)
    files = {"file": ("doc.pdf", b"data", "application/pdf")}
    resp = client.post("/analyze", files=files, headers={"X-API-Key": "test-key"})
    assert resp.status_code == 400
    assert resp.json()["detail"] == "Virus detected"
