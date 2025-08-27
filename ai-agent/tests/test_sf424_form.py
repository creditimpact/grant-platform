from fastapi.testclient import TestClient
import main

client = TestClient(main.app)


def test_sf424_merging_and_funding_total():
    user_payload = {
        "applicant_legal_name": "User Corp",
        "ein": "12-3456789",
        "descriptive_title": "My Project",
        "project_start_date": "2024-01-01",
        "project_end_date": "2024-12-31",
        "authorized_rep_name": "Alice",
        "authorized_rep_title": "CEO",
        "authorized_rep_date_signed": "2024-06-01",
        "funding_federal": "$1,000",
        "funding_applicant": "200",
    }
    analyzer_fields = {"applicant_legal_name": "Analyzer Corp"}
    resp = client.post(
        "/form-fill",
        json={
            "form_name": "form_sf424",
            "user_payload": user_payload,
            "analyzer_fields": analyzer_fields,
        },
    )
    assert resp.status_code == 200
    fields = resp.json()["filled_form"]["fields"]
    assert fields["applicant_legal_name"] == "User Corp"
    assert fields["project_start_date"] == "2024-01-01"
    assert fields["funding_federal"] == 1000.0
    assert fields["funding_applicant"] == 200.0
    assert fields["funding_total"] == 1200.0
