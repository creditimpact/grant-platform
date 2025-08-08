import os
import logging
from importlib import reload

from fastapi.testclient import TestClient


def get_client():
    os.environ["INTERNAL_API_KEY"] = "test-key"
    import main as main_module
    reload(main_module)
    return TestClient(main_module.app)


def test_requires_api_key(caplog):
    client = get_client()
    with caplog.at_level(logging.INFO):
        resp = client.get("/status")
    assert resp.status_code == 401
    assert any(r.message == "auth_failure" for r in caplog.records)

    caplog.clear()
    with caplog.at_level(logging.INFO):
        resp = client.get("/status", headers={"X-API-Key": "wrong"})
    assert resp.status_code == 401
    record = next(r for r in caplog.records if r.message == "auth_failure")
    assert record.api_key == "[REDACTED]"

    resp = client.get("/status", headers={"X-API-Key": "test-key"})
    assert resp.status_code == 200
