import os
import tests.env_setup  # noqa: F401
from fastapi.testclient import TestClient
from importlib import reload
import common.limiting as limiting


def get_client():
    import main as main_module
    reload(main_module)
    return TestClient(main_module.app)


def test_rate_limit_basic():
    os.environ["ENABLE_RATE_LIMIT"] = "true"
    os.environ["RATE_LIMIT_PER_MINUTE"] = "2"
    os.environ["RATE_LIMIT_WINDOW_SEC"] = "60"
    os.environ["AI_ANALYZER_API_KEY"] = "k1"
    limiting._hits.clear()
    client = get_client()
    headers = {"X-API-Key": "k1"}
    for _ in range(2):
        assert client.get("/", headers=headers).status_code == 200
    assert client.get("/", headers=headers).status_code == 429


def test_healthz_not_limited():
    os.environ["ENABLE_RATE_LIMIT"] = "true"
    os.environ["RATE_LIMIT_PER_MINUTE"] = "1"
    os.environ["RATE_LIMIT_WINDOW_SEC"] = "60"
    limiting._hits.clear()
    client = get_client()
    for _ in range(3):
        assert client.get("/healthz").status_code == 200


def test_identity_prefers_api_key():
    os.environ["ENABLE_RATE_LIMIT"] = "true"
    os.environ["RATE_LIMIT_PER_MINUTE"] = "1"
    os.environ["RATE_LIMIT_WINDOW_SEC"] = "60"
    os.environ["AI_ANALYZER_API_KEY"] = "k1"
    os.environ["AI_ANALYZER_NEXT_API_KEY"] = "k2"
    limiting._hits.clear()
    client = get_client()
    assert client.get("/", headers={"X-API-Key": "k1"}).status_code == 200
    assert client.get("/", headers={"X-API-Key": "k2"}).status_code == 200
