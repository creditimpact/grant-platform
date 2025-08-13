import os
from fastapi import TestClient
from importlib import reload


def get_client():
    import main as main_module
    reload(main_module)
    return TestClient(main_module.app)


def test_api_key_auth():
    os.environ["AI_ANALYZER_API_KEY"] = "valid"
    client = get_client()
    assert client.get("/", headers={"X-API-Key": "valid"}).status_code == 200
    assert client.get("/", headers={"X-API-Key": "bad"}).status_code == 401


def test_health_ready_endpoints():
    client = get_client()
    assert client.get("/healthz").status_code == 200
    assert client.get("/readyz").status_code == 200


def test_readyz_fails_without_key():
    os.environ["SECURITY_ENFORCEMENT_LEVEL"] = "prod"
    os.environ.pop("AI_ANALYZER_API_KEY", None)
    client = get_client()
    assert client.get("/readyz").status_code == 503
    os.environ["SECURITY_ENFORCEMENT_LEVEL"] = "dev"
    os.environ["AI_ANALYZER_API_KEY"] = "test-key"
