import main
from fastapi.testclient import TestClient

client = TestClient(main.app)

def test_form_424A_calculations():
    payload = {
        "a_row1_program": "Prog1",
        "a_row1_assistance_listing": "12.345",
        "a_row1_unobligated_federal": 100,
        "a_row1_unobligated_non_federal": 50,
        "a_row1_new_federal": 200,
        "a_row1_new_non_federal": 100,
        "b_personnel_col1": 1000,
        "b_personnel_col2": 2000,
        "b_equipment_col1": 500,
        "b_indirect_col1": 100,
        "b_program_income_col1": 10,
        "c_row8_program": "P1",
        "c_row8_applicant": 10,
        "c_row8_state": 20,
        "c_row8_other": 30,
        "c_row9_program": "P2",
        "c_row9_applicant": 5,
        "c_row9_state": 5,
        "d_cash_needs_federal_q1": 100,
        "d_cash_needs_federal_q2": 50,
        "d_cash_needs_non_federal_q1": 20,
        "e_row16_program": "EA",
        "e_row16_y1": 100,
        "e_row17_program": "EB",
        "e_row17_y1": 50,
        "f_other_direct_charges": 100,
        "f_other_indirect_charges": 10,
        "f_other_remarks": "ok",
    }
    resp = client.post(
        "/form-fill",
        json={"form_name": "form_424A", "user_payload": payload, "analyzer_fields": {}},
    )
    assert resp.status_code == 200
    filled = resp.json()["filled_form"]
    fields = filled["fields"]
    assert filled["missing_keys"] == []
    assert filled["calc_mismatches"] == []
    assert fields["a_row1_total"] == 450.0
    assert fields["a_row5_unobligated_federal"] == 100.0
    assert fields["b_personnel_total"] == 3000.0
    assert fields["b_total_direct_col1"] == 1500.0
    assert fields["b_indirect_total"] == 100.0
    assert fields["b_totals_col1"] == 1600.0
    assert fields["c_row8_totals"] == 60.0
    assert fields["c_row12_applicant"] == 15.0
    assert fields["d_cash_needs_federal_total"] == 150.0
    assert fields["d_cash_needs_total_q1"] == 120.0
    assert fields["e_row16_total"] == 100.0
    assert fields["e_row20_y1"] == 150.0


def test_form_424A_mismatch_detected():
    payload = {
        "a_row1_program": "Prog1",
        "a_row1_assistance_listing": "12.3",
        "a_row1_unobligated_federal": 100,
        "b_personnel_col1": 100,
        "b_personnel_total": 50,
    }
    resp = client.post(
        "/form-fill",
        json={"form_name": "form_424A", "user_payload": payload, "analyzer_fields": {}},
    )
    assert resp.status_code == 200
    filled = resp.json()["filled_form"]
    assert filled["calc_mismatches"]
    paths = {m["path"] for m in filled["calc_mismatches"]}
    assert "b_personnel_total" in paths
