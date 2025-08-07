import json
from pathlib import Path

import sys
import asyncio
import pytest
from pydantic import ValidationError

sys.path.insert(0, str(Path(__file__).parent))
from main import check, form_fill, chat
from form_filler import fill_form as direct_fill_form
from nlp_utils import normalize_text_field, infer_field_from_text
BASE_DIR = Path(__file__).parent
ENGINE_DIR = BASE_DIR.parent / "eligibility-engine"


def load_payload():
    with (ENGINE_DIR / "test_payload.json").open() as f:
        return json.load(f)


def test_check_direct():
    payload = load_payload()

    class DummyRequest:
        def __init__(self, data):
            self._data = data
            self.headers = {"content-type": "application/json"}

        async def json(self):
            return self._data

    data = asyncio.run(check(DummyRequest(payload)))
    assert isinstance(data, list)
    assert any("eligible" in r for r in data)


def test_check_document():
    doc_path = BASE_DIR / "test_documents" / "fake_tz.pdf"

    class DummyRequest:
        def __init__(self):
            self.headers = {"content-type": "multipart/form-data"}

        async def json(self):
            return {}

    class DummyUpload:
        def __init__(self, b):
            self._b = b

        async def read(self):
            return self._b

    with doc_path.open("rb") as f:
        data = asyncio.run(check(DummyRequest(), file=DummyUpload(f.read())))
    assert isinstance(data, list)


def test_form_fill():
    payload = load_payload()
    payload["startup_year"] = "2022"
    payload["industry"] = "technology"
    data = asyncio.run(form_fill({"form_name": "tech_startup_credit_form", "user_payload": payload}))
    form = data["filled_form"]
    assert form["fields"]["state"] != ""
    assert form["fields"].get("is_new_tech") is True


def test_form_fill_partial_inference():
    payload = {"zip": "94110", "owner_gender": "probably yes", "startup_year": "2021"}
    data = asyncio.run(form_fill({"form_name": "tech_startup_credit_form", "user_payload": payload}))
    form = data["filled_form"]
    assert form["fields"].get("state") == "CA"
    assert form["fields"].get("mission_statement") != ""


def test_nlp_utils():
    k, v = normalize_text_field("headcount", "$80k")
    assert k == "employees" and v == 80000
    result = infer_field_from_text("I am a woman founder with 3 employees founded 2020")
    assert result.get("owner_gender") == "female"
    assert result.get("employees") == 3
    assert "business_age_years" in result


def test_chat_info():
    resp = asyncio.run(chat({"mode": "info"}))
    assert "response" in resp


def test_freeform_notes():
    notes = "We started around 2021. We're women-led in biotech. No, not veteran-owned."

    class DummyRequest:
        def __init__(self, data):
            self._data = data
            self.headers = {"content-type": "application/json"}

        async def json(self):
            return self._data

    data = asyncio.run(check(DummyRequest({"notes": notes}), explain=True))
    assert any(r.get("reasoning_steps") is not None for r in data)


def test_chat_llm():
    resp = asyncio.run(chat({"session_id": "test1", "text": "Hello"}))
    assert isinstance(resp.get("response"), str) and resp["response"] != ""


def test_form_fill_invalid_payload():
    """Invalid payloads should raise validation errors."""
    with pytest.raises(ValidationError):
        asyncio.run(form_fill({"user_payload": {"foo": "bar"}}))


def test_form_fill_rejects_embedded_payload():
    """Legacy embedded bodies should not be accepted after Pydantic v2 upgrade."""
    payload = {"request_model": {"form_name": "tech_startup_credit_form", "user_payload": {}}}
    with pytest.raises(ValidationError):
        asyncio.run(form_fill(payload))


def test_form_6765_template_loads():
    """Ensure the new Form 6765 template is accessible."""
    form = direct_fill_form("form_6765", {})
    assert "Form" in form["fields"]
