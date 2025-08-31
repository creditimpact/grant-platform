from src.detectors import identify
from src.detectors import identify
from src.extractors.w9_form import detect, extract

SAMPLE = """Form W-9 (Rev. October 2018)
Request for Taxpayer Identification Number and Certification
Name: John Doe
Business name: JD Widgets LLC
TIN: 12-3456789
Address: 123 Main St Anytown CA 90210
Signature: John Doe   01/15/2024
"""

NEGATIVE = "This is just a random letter with no tax info."


def test_detect_and_extract():
    assert detect(SAMPLE) is True
    det = identify(SAMPLE)
    assert det["type_key"] == "W9_Form"
    out = extract(SAMPLE, "uploads/w9.pdf")
    assert out["doc_type"] == "W9_Form"
    fields = out["fields"]
    assert fields["tin"] == "12-3456789"
    assert fields["legal_name"].startswith("John Doe")
    assert fields["entity_type"].upper() == "LLC"
    assert fields["signature_date"] == "2024-01-15"


def test_negative_sample():
    assert detect(NEGATIVE) is False
    det = identify(NEGATIVE)
    assert det == {}
