from fastapi.testclient import TestClient
import main

client = TestClient(main.app)


def test_rd4008_merge_checkboxes_and_stats():
    user_payload = {
        "state": "CA",
        "county": "Orange",
        "case_number": "123",
        "date_of_review": "2024-01-01",
        "borrower_name": "ACME",
        "source_of_funds": "Direct",
        "type_of_assistance": ["Community Facilities", "Other"],
    }
    analyzer_fields = {
        "state": "NY",
        "section_i_statistical_information": {
            "a1_population_participants_ethnicity": {
                "this_review": {
                    "male": {
                        "hispanic_or_latino": {"number": 5, "percentage": 50}
                    }
                }
            }
        },
    }
    resp = client.post(
        "/form-fill",
        json={
            "form_name": "form_RD_400_8",
            "user_payload": user_payload,
            "analyzer_fields": analyzer_fields,
        },
    )
    assert resp.status_code == 200
    fields = resp.json()["filled_form"]["fields"]
    assert fields["state"] == "CA"
    assert fields["source_of_funds_direct"] is True
    assert fields["source_of_funds_insured"] is False
    assert fields["type_of_assistance_community_facilities"] is True
    assert fields["type_of_assistance_other"] is True
    assert fields["a1_population_this_review_male_hispanic_number"] == 5
    assert fields["a1_population_this_review_male_hispanic_percentage"] == 50
