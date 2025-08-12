import os
from importlib import reload
from fastapi import TestClient
import env_setup  # ENV VALIDATION: seed env vars


def get_client():
    import main as main_module
    reload(main_module)
    return TestClient(main_module.app)


def test_requires_api_key():
    client = get_client()
    resp = client.get("/status")
    assert resp.status_code == 401
    resp = client.get("/status", headers={"X-API-Key": "test-key"})
    assert resp.status_code == 200
