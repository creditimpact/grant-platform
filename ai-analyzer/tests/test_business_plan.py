from pathlib import Path
from pathlib import Path
from src.detectors import identify
from src.extractors.business_plan import detect, extract

SAMPLE = (Path(__file__).resolve().parent / "fixtures" / "business_plan_sample.txt").read_text()
NEGATIVE = "This document talks about operations but lacks a plan."


def test_detect_and_extract_business_plan():
    assert detect(SAMPLE) is True
    det = identify(SAMPLE)
    assert det["type_key"] == "Business_Plan"
    out = extract(SAMPLE, "uploads/bizplan.pdf")
    assert out["doc_type"] == "Business_Plan"
    fields = out["fields"]
    assert fields["business_name"] == "ACME MOTORS LLC"
    assert "Acme Motors builds modular electric drivetrains" in fields["executive_summary"]
    assert fields["funding_request_amount"] == 125000
    assert fields["period_years"] == 3
    assert fields["last_updated"] == "2025-08-31"


def test_negative_sample():
    assert detect(NEGATIVE) is False
    det = identify(NEGATIVE)
    assert det == {}
