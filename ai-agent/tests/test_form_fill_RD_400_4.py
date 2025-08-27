from fastapi.testclient import TestClient
import main

client = TestClient(main.app)


def test_rd4004_merge_precedence_and_defaults():
    user_payload = {
        "recipient_name": "Acme Corp",
        "recipient_address_street": "123 Main St",
        "recipient_address_city": "Townsville",
        "recipient_address_state": "California",
        "recipient_address_zip": "12345",
        "recipient_title": "CEO",
        "date_signed": "2024-10-19",
    }
    analyzer_fields = {
        "recipient_address_state": "NY",
        "recipient_address_zip": "54321",
        "attest_title": "Notary",
    }
    resp = client.post(
        "/form-fill",
        json={
            "form_name": "form_RD_400_4",
            "user_payload": user_payload,
            "analyzer_fields": analyzer_fields,
        },
    )
    assert resp.status_code == 200
    fields = resp.json()["filled_form"]["fields"]
    required_keys = [
        "recipient_name",
        "recipient_address_street",
        "recipient_address_city",
        "recipient_address_state",
        "recipient_address_zip",
        "recipient_title",
        "date_signed",
    ]
    for k in required_keys:
        assert k in fields
    assert fields["recipient_address_state"] == "CA"
    assert fields["recipient_address_zip"] == "12345"
    assert fields["attest_title"] == "Notary"
    assert fields["seal_required"] is True
    assert fields["date_signed"] == "2024-10-19"
