from fastapi import TestClient
from main import app
from config import settings


def test_api_key_auth():
    settings.AI_ANALYZER_API_KEY = "valid"
    settings.AI_ANALYZER_NEXT_API_KEY = None
    client = TestClient(app)
    assert client.get("/", headers={"X-API-Key": "valid"}).status_code == 200
    assert client.get("/", headers={"X-API-Key": "bad"}).status_code == 401


def test_api_key_rotation():
    settings.AI_ANALYZER_API_KEY = "old"
    settings.AI_ANALYZER_NEXT_API_KEY = "new"
    client = TestClient(app)
    assert client.get("/", headers={"X-API-Key": "old"}).status_code == 200
    assert client.get("/", headers={"X-API-Key": "new"}).status_code == 200
    settings.AI_ANALYZER_API_KEY = "new"
    settings.AI_ANALYZER_NEXT_API_KEY = None
    assert client.get("/", headers={"X-API-Key": "old"}).status_code == 401
    assert client.get("/", headers={"X-API-Key": "new"}).status_code == 200
