from fastapi.testclient import TestClient
import main

client = TestClient(main.app)


def test_dd_mm_yyyy_normalized():
    resp = client.post(
        "/check", json={"profile": {"incorporation_date": "19/10/2024"}}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["normalized_profile"]["incorporation_date"] == "2024-10-19"
    assert any(
        "incorporation_date" in step for step in body["reasoning"]["reasoning_steps"]
    )


def test_mm_dd_yyyy_normalized():
    resp = client.post(
        "/check", json={"profile": {"incorporation_date": "10/11/2024"}}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["normalized_profile"]["incorporation_date"] == "2024-11-10"
