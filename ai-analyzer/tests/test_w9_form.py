import env_setup  # noqa: F401
from pathlib import Path
from fastapi.testclient import TestClient

from ai_analyzer.main import app
from src.detectors import identify
from src.extractors.w9_form import detect as detect_w9, extract

FIXTURES = Path(__file__).resolve().parent / "fixtures"
SAMPLE = (FIXTURES / "w9_form_sample.txt").read_text()
NOISY = (FIXTURES / "w9_form_noisy.txt").read_text()
MULTILINE = (FIXTURES / "w9_form_multiline.txt").read_text()
INSTRUCTIONAL = (FIXTURES / "w9_form_instructional.txt").read_text()
NEGATIVE = "This is just a random letter with no tax info."

SAMPLE_NO_HYPHEN = SAMPLE.replace("TIN: 12-3456789", "TIN: 123456789")
SAMPLE_SPACED = SAMPLE.replace("TIN: 12-3456789", "TIN: 12 3456789")

SAMPLE_DATE_NEXTLINE = SAMPLE.replace(
    "Signature of U.S. person John Doe 01/15/2024",
    "Signature of U.S. person John Doe\nDate: 01/15/2024",
)
SAMPLE_DATE_TEXT = SAMPLE.replace("01/15/2024", "January 15, 2024")
SAMPLE_DATE_DASH = SAMPLE.replace("01/15/2024", "01-15-24")

client = TestClient(app)


def test_detect_and_extract():
    assert detect_w9(SAMPLE) is True
    det = identify(SAMPLE)
    assert det["type_key"] == "W9_Form"
    out = extract(SAMPLE, "uploads/w9.pdf")
    assert out["doc_type"] == "W9_Form"
    fields = out["fields"]
    for key in [
        "legal_name",
        "business_name",
        "tin",
        "entity_type",
        "address",
        "date_signed",
    ]:
        assert key in fields
    assert fields["tin"] == "12-3456789"
    assert fields["legal_name"] == "John Doe"
    assert fields["business_name"] == "JD Widgets LLC"
    assert "llc" in fields["entity_type"].lower()
    assert "Anytown" in fields["address"]
    assert fields["date_signed"] == "2024-01-15"


def test_negative_sample():
    assert detect_w9(NEGATIVE) is False
    det = identify(NEGATIVE)
    assert det == {}


def test_multiline_names():
    out = extract(MULTILINE)
    fields = out["fields"]
    assert fields["legal_name"] == "Mega Corp Inc"
    assert fields["business_name"] == "Mega Holdings LLC"


def test_noisy_instructions_trimmed():
    out = extract(NOISY)
    fields = out["fields"]
    assert fields["legal_name"] == "John Q Public"
    assert fields["business_name"] == "Public Ventures LLC"
    assert fields["date_signed"] == "2024-02-02"


def test_tin_variants_normalize():
    out = extract(SAMPLE_NO_HYPHEN)
    assert out["fields"]["tin"] == "12-3456789"
    out = extract(SAMPLE_SPACED)
    assert out["fields"]["tin"] == "12-3456789"


def test_alternate_date_formats():
    out = extract(SAMPLE_DATE_NEXTLINE)
    assert out["fields"]["date_signed"] == "2024-01-15"
    out = extract(SAMPLE_DATE_TEXT)
    assert out["fields"]["date_signed"] == "2024-01-15"
    out = extract(SAMPLE_DATE_DASH)
    assert out["fields"]["date_signed"] == "2024-01-15"


def test_analyze_endpoint_returns_w9_fields():
    resp = client.post("/analyze", json={"text": SAMPLE})
    assert resp.status_code == 200
    data = resp.json()
    assert data["doc_type"] == "W9_Form"
    fields = data.get("fields", {})
    for key in [
        "legal_name",
        "business_name",
        "tin",
        "entity_type",
        "address",
        "date_signed",
    ]:
        assert key in fields
    assert fields["tin"] == "12-3456789"
    assert fields["business_name"] == "JD Widgets LLC"


def test_analyze_endpoint_trims_instructions():
    resp = client.post("/analyze", json={"text": NOISY})
    assert resp.status_code == 200
    data = resp.json()
    assert data["doc_type"] == "W9_Form"
    fields = data.get("fields", {})
    assert fields["legal_name"] == "John Q Public"
    assert fields["business_name"] == "Public Ventures LLC"
    assert fields["date_signed"] == "2024-02-02"


def test_extract_provides_fields_clean():
    out = extract(SAMPLE)
    assert "fields_clean" in out
    assert out["fields_clean"]["legal_name"] == "John Doe"


def test_analyze_handles_instructional_noise():
    resp = client.post("/analyze", json={"text": INSTRUCTIONAL})
    assert resp.status_code == 200
    data = resp.json()
    assert data["doc_type"] == "W9_Form"
    assert data["fields"] == {
        "legal_name": "DAM CAPITAL GROUP CORP",
        "business_name": "Lenderfy capital",
        "tin": "12-3456789",
        "entity_type": "LLC",
        "address": "101 Diplomat Pkwy Unit 2301, Hallandale Beach, FL 33009",
        "date_signed": "2023-10-05",
    }


def test_analyze_prefers_clean_fields(monkeypatch):
    def fake_extract(text, evidence_key=None):
        return {
            "doc_type": "W9_Form",
            "confidence": 0.9,
            "fields": {"legal_name": "1 Name (as shown on your income tax return) John Doe"},
            "fields_clean": {"legal_name": "John Doe"},
        }

    monkeypatch.setattr("src.extractors.w9_form.extract", fake_extract)
    resp = client.post("/analyze", json={"text": SAMPLE})
    assert resp.status_code == 200
    data = resp.json()
    assert data["fields"]["legal_name"] == "John Doe"
