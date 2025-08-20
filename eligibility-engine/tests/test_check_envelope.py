from fastapi.testclient import TestClient
import pytest

pytest.importorskip("fastapi")
from fastapi.testclient import TestClient

from api import app

client = TestClient(app)


def test_bad_body_returns_400():
    resp = client.post("/check", json=None)
    assert resp.status_code == 400
    assert "detail" in resp.json()


def test_happy_path_envelope():
    resp = client.post("/check", json={"owner_veteran": True})
    assert resp.status_code == 200
    body = resp.json()
    assert "results" in body and isinstance(body["results"], list)
    assert "requiredForms" in body and isinstance(body["requiredForms"], list)


def test_validation_error_is_422(monkeypatch):
    async def boom(_payload):
        raise KeyError("business_location_country")

    monkeypatch.setattr("api.compute_grant_results", boom)
    resp = client.post("/check", json={"foo": "bar"})
    assert resp.status_code == 422
    assert "business_location_country" in resp.json()["detail"]


def test_unexpected_error_returns_500(monkeypatch):
    async def boom(_payload):
        raise RuntimeError("boom")

    monkeypatch.setattr("api.compute_grant_results", boom)
    resp = client.post("/check", json={"foo": "bar"})
    assert resp.status_code == 500
    assert resp.json()["detail"] == "Unexpected server error. Please retry or contact support."
