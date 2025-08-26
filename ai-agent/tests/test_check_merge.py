from fastapi.testclient import TestClient
import main

client = TestClient(main.app)


def test_user_overrides_analyzer():
    payload = {
        "profile": {"ein": "222222222"},
        "analyzer_fields": {"ein": "111111111"},
    }
    resp = client.post("/check", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["normalized_profile"]["ein"] == "222222222"


def test_analyzer_fills_missing():
    payload = {
        "profile": {},
        "analyzer_fields": {"entity_type": "LLC"},
    }
    resp = client.post("/check", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["normalized_profile"]["entity_type"] == "LLC"


def test_mixed_merge():
    payload = {
        "profile": {"ein": "222222222"},
        "analyzer_fields": {"ein": "111111111", "year_founded": 2019},
    }
    resp = client.post("/check", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["normalized_profile"]["ein"] == "222222222"
    assert data["normalized_profile"]["year_founded"] == 2019
