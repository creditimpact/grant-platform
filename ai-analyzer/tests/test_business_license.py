from src.detectors import identify
from src.extractors.business_license import detect_business_license, extract

SAMPLE = """
Application for General Business License
Applicant Name: Jane Doe
Date of Birth: 01/01/1990
Home Address: 123 Home St
Business Name: Doe Ventures
Business Address: 456 Biz Ave
Type of Business: Consulting
"""

def test_detect_business_license():
    assert detect_business_license(SAMPLE)
    det = identify(SAMPLE)
    assert det["type_key"] == "Business_License"
    assert det["confidence"] >= 0.5

def test_extract_fields():
    result = extract(SAMPLE)
    fields = result["fields"]
    assert fields["applicant_name"] == "Jane Doe"
    assert fields["business_name"] == "Doe Ventures"
    assert fields["type_of_business"] == "Consulting"
    assert fields["date_of_birth"] == "1990-01-01"
