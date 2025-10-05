from src.detectors import identify
from src.extractors.Business_License import extract

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
    det = identify(SAMPLE)
    assert det["type_key"] == "Business_License"
    assert det["confidence"] >= 0.6


def test_extract_fields():
    result = extract(SAMPLE)
    assert result["applicant_name"] == "Jane Doe"
    assert result["business_name"] == "Doe Ventures"
    assert result["type_of_business"] == "Consulting"
    assert result["date_of_birth"] == "1990-01-01"
