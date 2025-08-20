from fastapi.testclient import TestClient
import pytest
import main


client = TestClient(main.app)


def test_bad_types_return_422():
    resp = client.post("/check", json={"profile": {"w2_employee_count": "ten"}})
    assert resp.status_code == 422


def test_unknown_fields_ignored():
    resp = client.post(
        "/check", json={"profile": {"ein": "12-3456789", "foo": "bar"}}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "foo" not in body["normalized_profile"]
