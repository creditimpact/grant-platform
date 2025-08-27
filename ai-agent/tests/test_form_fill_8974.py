import main
from fastapi.testclient import TestClient

client = TestClient(main.app)


def test_form_8974_merge_and_calculations():
    payload = {
        "name": "User Corp",
        "calendar_year": "2024",
        "credit_reporting_selected_form": "form_941",
        "quarter_selection_selected_quarter": "q2",
        "line1_ending_date": "2023-12-31",
        "line1_income_tax_return": "1120S",
        "line1_date_filed": "2024-03-15",
        "line1_ein_used": "98-7654321",
        "line1_amount_form_6765": 100,
        "line1_credit_taken_previous": 0,
        "line1_remaining_credit": 100,
        "line2_ending_date": "2022-12-31",
        "line2_income_tax_return": "1120S",
        "line2_date_filed": "2023-03-15",
        "line2_ein_used": "98-7654321",
        "line2_amount_form_6765": 200,
        "line2_credit_taken_previous": 0,
        "line2_remaining_credit": 200,
        "line7": 300,
        "line8": 100,
        "line9": 0,
        "line14": 200,
        "line11_third_party_payer": True,
    }
    analyzer_fields = {
        "employer_identification_number": "12-3456789",
        "name": "Analyzer Inc",
    }
    resp = client.post(
        "/form-fill",
        json={
            "form_name": "form_8974",
            "user_payload": payload,
            "analyzer_fields": analyzer_fields,
        },
    )
    assert resp.status_code == 200
    fields = resp.json()["filled_form"]["fields"]
    assert fields["employer_identification_number"] == "12-3456789"
    assert fields["name"] == "User Corp"
    assert fields["credit_reporting_selected_form"] == "form_941"
    assert fields["quarter_selection_selected_quarter"] == "q2"
    assert fields["line11_third_party_payer"] is True
    assert fields["line6"] == 300.0
    assert fields["line10"] == 100.0
    assert fields["line11"] == 50.0
    assert fields["line12"] == 50.0
    assert fields["line13"] == 250.0
    assert fields["line15"] == 100.0
    assert fields["line16"] == 100.0
    assert fields["line17"] == 150.0
