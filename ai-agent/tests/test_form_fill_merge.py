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
    assert any("filled" in s and "reporting_quarter" in s for s in steps)
