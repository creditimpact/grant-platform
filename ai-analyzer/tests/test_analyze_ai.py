import json
import env_setup  # noqa: F401
from fastapi.testclient import TestClient
import ai_analyzer.main as main

client = TestClient(main.app)


def test_analyze_ai_json(monkeypatch):
    sample = {
        "ein": "12-3456789",
        "w2_employee_count": 5,
        "quarterly_revenues": {"Q1": 1.0, "Q2": 2.0, "Q3": 3.0, "Q4": 4.0},
        "entity_type": "LLC",
        "year_founded": 2020,
        "annual_revenue": 1000.0,
        "location_state": "CA",
        "location_country": "US",
        "minority_owned": True,
        "female_owned": False,
        "veteran_owned": False,
        "ppp_reference": None,
        "ertc_reference": None,
    }

    class DummyResp:
        choices = [
            type(
                "C",
                (),
                {"message": type("M", (), {"content": json.dumps(sample)})()},
            )
        ]

    def fake_create(**_):
        return DummyResp()

    monkeypatch.setattr(
        main.openai_client.chat.completions, "create", fake_create
    )

    resp = client.post("/analyze-ai", json={"text": "hello"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["ein"] == "12-3456789"
    assert data["raw_text_preview"] == "hello"
    assert data["source"] == "text"
