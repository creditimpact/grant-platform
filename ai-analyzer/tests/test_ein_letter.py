from src.detectors import identify
from src.extractors.ein_letter import detect, extract

CLEAN_CP575 = """Department of the Treasury
Internal Revenue Service
Date: October 19, 2016
ACME WIDGETS LLC
123 MAIN ST
ANYTOWN CA 12345
This is your Employer Identification Number: 12-3456789
Notice CP 575 G
"""

NOISY_CP575 = """CP 575 A
Your Employer Identification Number is 98-7654321.
Issued 10-20-2016
"""

NEGATIVE = "This letter has nothing to do with taxes."


def test_detect_cp575():
    assert detect(CLEAN_CP575) is True
    det = identify(CLEAN_CP575)
    assert det["type_key"] == "EIN_Letter"
    out = extract(CLEAN_CP575, "uploads/sample.pdf")
    assert out["doc_type"] == "EIN_Letter"
    fields = out["fields"]
    assert fields["ein"] == "12-3456789"
    assert fields["issue_date"] == "2016-10-19"
    assert fields["notice_code"] == "CP 575 G"
    assert fields["business_name"] == "ACME WIDGETS LLC"
    assert "ANYTOWN CA 12345" in fields["address"]


def test_extract_noisy_variant():
    assert detect(NOISY_CP575) is True
    out = extract(NOISY_CP575, "uploads/noisy.pdf")
    fields = out["fields"]
    assert fields["ein"] == "98-7654321"
    assert fields["issue_date"] == "2016-10-20"


def test_negative_sample():
    assert detect(NEGATIVE) is False
    det = identify(NEGATIVE)
    assert det == {}

