# ENV VALIDATION: tests for ai-analyzer config
import importlib
import pytest

REQUIRED = ["AI_ANALYZER_API_KEY", "TLS_CERT_PATH", "TLS_KEY_PATH"]


def minimal_env(tmp_path):
    f = tmp_path / "a.pem"
    f.write_text("x")
    return {
        "AI_ANALYZER_API_KEY": "k",
        "TLS_CERT_PATH": str(f),
        "TLS_KEY_PATH": str(f),
    }


def test_missing_env(monkeypatch, tmp_path):
    env = minimal_env(tmp_path)
    for key in REQUIRED:
        monkeypatch.delenv(key, raising=False)
    for k, v in env.items():
        if k != "AI_ANALYZER_API_KEY":
            monkeypatch.setenv(k, v)
    with pytest.raises(Exception):
        importlib.reload(importlib.import_module('config'))


def test_defaults(monkeypatch, tmp_path):
    env = minimal_env(tmp_path)
    for key in REQUIRED:
        monkeypatch.delenv(key, raising=False)
    for k, v in env.items():
        monkeypatch.setenv(k, v)
    cfg = importlib.reload(importlib.import_module('config')).settings
    assert cfg.TLS_CA_PATH is None
