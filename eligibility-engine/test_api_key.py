from fastapi import TestClient
from api import app
from config import settings


def test_api_key_auth():
    settings.ELIGIBILITY_ENGINE_API_KEY = "valid"
    settings.ELIGIBILITY_ENGINE_NEXT_API_KEY = None
    client = TestClient(app)
    assert client.get("/", headers={"X-API-Key": "valid"}).status_code == 200
    assert client.get("/", headers={"X-API-Key": "bad"}).status_code == 401


def test_api_key_rotation():
    settings.ELIGIBILITY_ENGINE_API_KEY = "old"
    settings.ELIGIBILITY_ENGINE_NEXT_API_KEY = "new"
    client = TestClient(app)
    assert client.get("/", headers={"X-API-Key": "old"}).status_code == 200
    assert client.get("/", headers={"X-API-Key": "new"}).status_code == 200
    settings.ELIGIBILITY_ENGINE_API_KEY = "new"
    settings.ELIGIBILITY_ENGINE_NEXT_API_KEY = None
    assert client.get("/", headers={"X-API-Key": "old"}).status_code == 401
    assert client.get("/", headers={"X-API-Key": "new"}).status_code == 200
