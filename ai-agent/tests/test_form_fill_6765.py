import main
from fastapi.testclient import TestClient

client = TestClient(main.app)

def test_form_6765_calculations():
    payload = {
        "names_shown_on_return": "Acme Robotics Inc.",
        "identifying_number": "12-3456789",
        "question_a_elect_reduced_credit": True,
        "line_14_value": 0,
        "line_15_value": 0,
        "line_16_value": 0,
        "line_20_value": 450000,
        "line_21_value": 600000,
        "line_27_value": 0,
        "line_29_value": 0,
        "line_33a_checked": True,
        "line_34_value": 38710,
        "line_35_value": 0,
        "line_42_value": 300000,
        "line_43_value": 50000,
        "line_44_value": 0,
        "line_45_value": 100000,
        "line_46_value": 0,
    }
    resp = client.post(
        "/form-fill",
        json={"form_name": "form_6765", "user_payload": payload, "analyzer_fields": {}},
    )
    assert resp.status_code == 200
    filled = resp.json()["filled_form"]
    fields = filled["fields"]
    assert filled["required_ok"] is True
    assert filled["missing_keys"] == []
    assert fields["line_22_value"] == 100000.0
    assert fields["line_23_value"] == 350000.0
    assert fields["line_24_value"] == 49000.0
    assert fields["line_25_value"] == 49000.0
    assert fields["line_26_value"] == 38710.0
    assert fields["line_28_value"] == 38710.0
    assert fields["line_28_source"] == "B"
    assert fields["line_30_value"] == 38710.0
    assert fields["line_32_value"] == 38710.0
    assert fields["line_36_value"] == 38710.0
    assert fields["line_47_value"] == 100000.0
    assert fields["line_48_value"] == 450000.0
