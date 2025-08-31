from src.detectors import identify
from src.extractors.articles_of_incorporation import (
    detect_articles_of_incorporation,
    extract,
)

SAMPLE_INC = """
Articles of Incorporation
Company Name: Example Corp
Entity Type: Corporation
Date of Incorporation: 05/01/2020
State of Incorporation: California
Registered Agent: John Agent
"""

SAMPLE_CERT = """
Certificate of Formation
Name: Sample LLC
State of Incorporation: Texas
Registered Agent: Jane Agent
"""


def test_detect_articles_of_incorporation():
    assert detect_articles_of_incorporation(SAMPLE_INC)
    det = identify(SAMPLE_INC)
    assert det["type_key"] == "Articles_Of_Incorporation"
    assert det["confidence"] >= 0.5


def test_detect_certificate_of_formation():
    assert detect_articles_of_incorporation(SAMPLE_CERT)
    det = identify(SAMPLE_CERT)
    assert det["type_key"] == "Articles_Of_Incorporation"


def test_extract_fields():
    result = extract(SAMPLE_INC)
    fields = result["fields"]
    assert fields["business_name"] == "Example Corp"
    assert fields["date_of_incorporation"] == "2020-05-01"
    assert fields["registered_agent"] == "John Agent"
    assert fields["state_of_incorporation"] == "California"
