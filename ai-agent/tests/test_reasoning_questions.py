from fastapi.testclient import TestClient
import main

client = TestClient(main.app)


def test_clarifying_questions_from_missing_fields(monkeypatch):
    def fake_analyze(user_data, explain=True):
        return [{"missing_fields": ["w2_employee_count", "entity_type"]}]

    monkeypatch.setattr(main, "analyze_eligibility", fake_analyze)
    resp = client.post("/check", json={"profile": {}})
    assert resp.status_code == 200
    questions = resp.json()["reasoning"]["clarifying_questions"]
    qmap = {q["field"]: q["question"] for q in questions}
    assert qmap["w2_employee_count"] == "How many W-2 employees do you have?"
    assert "entity_type" in qmap
