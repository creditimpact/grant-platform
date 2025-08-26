import logging
from fastapi.testclient import TestClient
import main
import fill_form
from config import settings

client = TestClient(main.app)


def test_prompt_driven_fill_uses_llm(monkeypatch, caplog):
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "sk-test")

    def fake_llm(prompt, context):
        if "entity" in prompt.lower():
            return "llc"
        return "Retail business in NY"

    monkeypatch.setattr(fill_form, "llm_complete", fake_llm)
    caplog.set_level(logging.INFO)

    resp = client.post(
        "/form-fill",
        json={"form_name": "form_sf424", "user_payload": {"ein": "12-3456789"}},
    )
    data = resp.json()["filled_form"]["fields"]
    assert data["business_summary"] == "Retail business in NY"
    assert data["entity_type"] == "LLC"
    messages = [r.message for r in caplog.records]
    assert "llm_invocation" in messages
    assert "llm_success" in messages


def test_llm_fallback_on_error(monkeypatch, caplog):
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "sk-test")

    def fake_llm(prompt, context):
        return ""

    monkeypatch.setattr(fill_form, "llm_complete", fake_llm)
    caplog.set_level(logging.INFO)

    resp = client.post(
        "/form-fill",
        json={"form_name": "form_sf424", "user_payload": {"industry": "retail"}},
    )
    data = resp.json()["filled_form"]["fields"]
    assert data["business_summary"]
    messages = [r.message for r in caplog.records]
    assert "llm_fallback" in messages


def test_entity_type_normalization(monkeypatch):
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "sk-test")

    def fake_llm(prompt, context):
        if "entity" in prompt.lower():
            return "s corp"
        return "Retail business"

    monkeypatch.setattr(fill_form, "llm_complete", fake_llm)

    resp = client.post(
        "/form-fill",
        json={"form_name": "form_sf424", "user_payload": {}},
    )
    data = resp.json()["filled_form"]["fields"]
    assert data["entity_type"] == "S-Corp"
