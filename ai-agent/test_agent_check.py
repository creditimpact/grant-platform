import json
from pathlib import Path

import sys
import asyncio

sys.path.insert(0, str(Path(__file__).parent))
from main import check, form_fill
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
    data = asyncio.run(form_fill({"grant": "sba_microloan_form", "data": payload}))
    assert "filled_form" in data
    assert "fields" in data["filled_form"]
