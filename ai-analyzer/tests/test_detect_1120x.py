from src.detectors import identify
from src.extractors.irs_1120x import extract

def test_identify_1120x():
    sample = "Amended U.S. Corporation Income Tax Return\nForm 1120X\nEIN: 12-3456789"
    det = identify(sample)
    assert det["type_key"] == "Form_1120X"
    assert det["confidence"] >= 0.5

def test_extract_ein_year():
    text = "Form 1120X\nEIN: 12-3456789\nFor tax year ending December 2023"
    fields = extract(text)
    assert fields["ein"] == "12-3456789"
    assert "2023" in fields["tax_year_ending"]
