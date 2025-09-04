from src.detectors import identify
from src.extractors.w9_form import detect, extract

SAMPLE = """Form W-9 (Rev. October 2018)
Request for Taxpayer Identification Number and Certification
Name (as shown on your income tax return) John Doe
Business name JD Widgets LLC
Limited Liability Company (LLC)
5 Address (number, street, and apt. or suite no.)
123 Main St
6 City, state, and ZIP code
Anytown CA 90210
TIN: 12-3456789
Signature of U.S. person John Doe 01/15/2024
"""

NEGATIVE = "This is just a random letter with no tax info."

SAMPLE_NO_HYPHEN = SAMPLE.replace("TIN: 12-3456789", "TIN: 123456789")
SAMPLE_SPACED = SAMPLE.replace("TIN: 12-3456789", "TIN: 12 3456789")

SAMPLE_NEXTLINE = """Form W-9
Request for Taxpayer Identification Number and Certification
Name (as shown on your income tax return)
Jane Nextline
"""


def test_detect_and_extract():
    assert detect(SAMPLE) is True
    det = identify(SAMPLE)
    assert det["type_key"] == "W9_Form"
    out = extract(SAMPLE, "uploads/w9.pdf")
    assert out["doc_type"] == "W9_Form"
    fields = out["fields"]
    for key in ["legal_name", "tin", "entity_type", "address", "date_signed"]:
        assert key in fields
    assert fields["tin"] == "12-3456789"
    assert fields["legal_name"].startswith("John Doe")
    assert "LLC" in fields["entity_type"].upper()
    assert "Anytown" in fields["address"]
    assert fields["date_signed"] == "2024-01-15"


def test_negative_sample():
    assert detect(NEGATIVE) is False
    det = identify(NEGATIVE)
    assert det == {}


def test_name_on_next_line():
    out = extract(SAMPLE_NEXTLINE)
    assert out["fields"]["legal_name"] == "Jane Nextline"


def test_tin_variants_normalize():
    out = extract(SAMPLE_NO_HYPHEN)
    assert out["fields"]["tin"] == "12-3456789"
    out = extract(SAMPLE_SPACED)
    assert out["fields"]["tin"] == "12-3456789"
