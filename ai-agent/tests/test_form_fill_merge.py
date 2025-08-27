from fastapi.testclient import TestClient
import main

client = TestClient(main.app)


def test_user_values_win_and_reasoning_logs_sources():
    payload = {"employer_identification_number": "12-3456789"}
    resp = client.post(
        "/form-fill",
        json={"form_name": "form_8974", "user_payload": payload},
    )
    assert resp.status_code == 200
    data = resp.json()
    fields = data["filled_form"]["fields"]
    assert fields["employer_identification_number"] == "12-3456789"
    assert "pdf" not in data
    steps = data["reasoning"]["reasoning_steps"]
    assert any("kept user value" in s and "employer_identification_number" in s for s in steps)
    assert any("filled" in s and "name" in s for s in steps)


def test_analyzer_fills_missing_field():
    resp = client.post(
        "/form-fill",
        json={
            "form_name": "form_8974",
            "user_payload": {},
            "analyzer_fields": {"employer_identification_number": "12-3456789"},
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    fields = data["filled_form"]["fields"]
    assert fields["employer_identification_number"] == "12-3456789"


def test_user_overrides_analyzer_field():
    resp = client.post(
        "/form-fill",
        json={
            "form_name": "form_8974",
            "user_payload": {"employer_identification_number": "98-7654321"},
            "analyzer_fields": {"employer_identification_number": "12-3456789"},
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    fields = data["filled_form"]["fields"]
    assert fields["employer_identification_number"] == "98-7654321"


def test_date_fields_preserved():
    resp = client.post(
        "/form-fill",
        json={
            "form_name": "form_8974",
            "user_payload": {"income_tax_period_ending_date": "2024-05-01"},
        },
    )
    assert resp.status_code == 200
    data = resp.json()["filled_form"]["fields"]
    assert data["income_tax_period_ending_date"] == "2024-05-01"
