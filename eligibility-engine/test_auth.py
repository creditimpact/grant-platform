import os
from importlib import reload
from fastapi.testclient import TestClient


def get_client():
    os.environ["INTERNAL_API_KEY"] = "test-key"
    import api as api_module
    reload(api_module)
    return TestClient(api_module.app)


def test_requires_api_key():
    client = get_client()
    resp = client.get("/status")
    assert resp.status_code == 401
    resp = client.get("/status", headers={"X-API-Key": "test-key"})
    assert resp.status_code == 200
