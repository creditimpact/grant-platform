# ENV VALIDATION: tests for ai-agent config
import importlib
import os
import pytest

def minimal_env(tmp_path):
    dummy = tmp_path / "a.pem"
    dummy.write_text("test")
    env = {
        "INTERNAL_API_KEY": "k",
        "OPENAI_API_KEY": "o",
        "MONGO_URI": "mongodb://localhost:27017", 
        "MONGO_USER": "u",
        "MONGO_PASS": "p",
        "MONGO_CA_FILE": str(dummy),
        "TLS_CERT_PATH": str(dummy),
        "TLS_KEY_PATH": str(dummy),
    }
    return env


def test_missing_env_raises(monkeypatch, tmp_path):
    env = minimal_env(tmp_path)
    env.pop("INTERNAL_API_KEY")
    for k in ["INTERNAL_API_KEY", "OPENAI_API_KEY", "MONGO_URI", "MONGO_USER", "MONGO_PASS", "MONGO_CA_FILE", "TLS_CERT_PATH", "TLS_KEY_PATH"]:
        monkeypatch.delenv(k, raising=False)
    for k, v in env.items():
        monkeypatch.setenv(k, v)
    with pytest.raises(Exception):
        importlib.reload(importlib.import_module('config'))


def test_defaults(monkeypatch, tmp_path):
    env = minimal_env(tmp_path)
    for k in env:
        monkeypatch.delenv(k, raising=False)
    for k, v in env.items():
        monkeypatch.setenv(k, v)
    cfg = importlib.reload(importlib.import_module('config')).settings
    assert cfg.ENABLE_DEBUG is False
