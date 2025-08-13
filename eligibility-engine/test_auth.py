import os
import logging
from importlib import reload
from fastapi import TestClient
import env_setup  # ENV VALIDATION: seed env vars


def get_client():
    import api as api_module
    reload(api_module)
    return TestClient(api_module.app)


def test_requires_api_key(caplog):
    client = get_client()
    with caplog.at_level(logging.INFO):
        resp = client.get("/status")
    assert resp.status_code == 401
    assert any(r.message == "auth_failed" for r in caplog.records)

    caplog.clear()
    with caplog.at_level(logging.INFO):
    resp = client.get("/status", headers={"X-API-Key": "wrong"})
    assert resp.status_code == 401
    record = next(r for r in caplog.records if r.message == "auth_failed")
    assert record.api_key == "[REDACTED]"

    resp = client.get("/status", headers={"X-API-Key": "test-key"})
    assert resp.status_code == 200
