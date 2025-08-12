import os
from types import SimpleNamespace
from common import vault


def test_load_vault_secrets(monkeypatch):
    class DummyClient:
        def __init__(self, *args, **kwargs):
            self.secrets = self
            self.kv = self
            self.v2 = self

        def is_authenticated(self):
            return True

        def read_secret_version(self, path):
            assert path == "engine/path"
            return {"data": {"data": {"ELIGIBILITY_ENGINE_API_KEY": "vault"}}}

    monkeypatch.setenv("VAULT_TOKEN", "token")
    monkeypatch.setenv("VAULT_SECRET_PATH", "engine/path")
    dummy_module = SimpleNamespace(Client=lambda *a, **k: DummyClient())
    with monkeypatch.context() as m:
        m.setattr(vault, "hvac", dummy_module)
        vault.load_vault_secrets()
    assert os.environ["ELIGIBILITY_ENGINE_API_KEY"] == "vault"
