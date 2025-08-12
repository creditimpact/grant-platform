import os
import logging
from importlib import reload

from fastapi import TestClient
import test_env_setup  # ENV VALIDATION: seed env vars


def get_client():
    import main as main_module
    reload(main_module)
    # Ensure the reloaded module picks up the test API key
    main_module.settings.AI_AGENT_API_KEY = os.environ["AI_AGENT_API_KEY"]
    main_module.settings.AI_AGENT_NEXT_API_KEY = None
    return TestClient(main_module.app)


def test_requires_api_key(caplog):
    client = get_client()
    with caplog.at_level(logging.INFO):
        resp = client.get("/status")
    assert resp.status_code == 401
    assert any(r.message == "auth_failure" for r in caplog.records)

    caplog.clear()
    with caplog.at_level(logging.INFO):
        resp = client.get("/status", headers={"X-API-Key": "wrong"})
    assert resp.status_code == 401
    record = next(r for r in caplog.records if r.message == "auth_failure")
    assert record.api_key == "[REDACTED]"

    resp = client.get("/status", headers={"X-API-Key": "test-key"})
    assert resp.status_code == 200
