import pytest

from mongo_uri import build_mongo_uri


def test_injects_credentials():
    uri = "mongodb://localhost:27017/agent"
    out = build_mongo_uri(uri, "user", "pass")
    assert out == "mongodb://user:pass@localhost:27017/agent"


def test_returns_original_without_creds():
    uri = "mongodb://localhost:27017/agent"
    assert build_mongo_uri(uri, None, None) == uri


def test_existing_credentials_not_overridden():
    uri = "mongodb://u:p@localhost:27017/agent"
    assert build_mongo_uri(uri, "x", "y") == uri


def test_partial_credentials_warning(caplog):
    uri = "mongodb://localhost:27017/agent"
    with caplog.at_level("WARNING", logger="mongo_uri"):
        out = build_mongo_uri(uri, "u", None)
    assert out == uri
    assert any("Partial" in r.getMessage() for r in caplog.records)


def test_log_masks_credentials(caplog):
    uri = "mongodb://localhost:27017/agent"
    with caplog.at_level("DEBUG", logger="mongo_uri"):
        build_mongo_uri(uri, "u", "p")
    msgs = "".join(r.getMessage() for r in caplog.records)
    assert "u" not in msgs
    assert "p" not in msgs
    assert "<hidden>" in msgs
