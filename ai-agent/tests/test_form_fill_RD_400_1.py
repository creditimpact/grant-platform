from fastapi.testclient import TestClient
import main


client = TestClient(main.app)


def test_rd4001_merge_yesno_and_required():
    user_payload = {
        "recipient_name": "Acme Corp",
        "recipient_address_street": "123 Main",
        "recipient_address_city": "Townsville",
        "recipient_address_state": "California",
        "recipient_address_zip": "12345-6789",
        "agreement_date": "2024-10-19",
        "recipient_title": "",
        "signing_date": "2024-10-20",
        "notify_unions": True,
    }
    analyzer_fields = {
        "recipient_title": "CEO",
        "recipient_address_state": "NY",
        "notify_unions": False,
    }
    resp = client.post(
        "/form-fill",
        json={
            "form_name": "form_RD_400_1",
            "user_payload": user_payload,
            "analyzer_fields": analyzer_fields,
        },
    )
    assert resp.status_code == 200
    fields = resp.json()["filled_form"]["fields"]
    required = [
        "recipient_name",
        "recipient_address_street",
        "recipient_address_city",
        "recipient_address_state",
        "recipient_address_zip",
        "agreement_date",
        "recipient_title",
        "signing_date",
    ]
    for k in required:
        assert k in fields
    assert fields["recipient_address_state"] == "CA"
    assert fields["recipient_address_zip"] == "12345-6789"
    assert fields["recipient_title"] == "CEO"
    assert fields["notify_unions"] == "yes"
    assert fields["agreement_date"] == "2024-10-19"
    assert fields["signing_date"] == "2024-10-20"

