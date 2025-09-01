from src.detectors import identify
from src.extractors.balance_sheet import detect, extract

SAMPLE = """Balance Sheet
As of December 31, 2024
Total Assets $750,000
Total Liabilities $300,000
Total Equity $450,000
"""

NEGATIVE = "This is not a financial statement."


def test_detect_and_extract():
    assert detect(SAMPLE) is True
    det = identify(SAMPLE)
    assert det["type_key"] == "Balance_Sheet"
    out = extract(SAMPLE, "bs.pdf")
    assert out["doc_type"] == "Balance_Sheet"
    fields = out["fields"]
    assert fields["as_of_date"] == "2024-12-31"
    assert fields["total_assets"] == 750000.0
    assert fields["total_liabilities"] == 300000.0
    assert fields["total_equity"] == 450000.0


def test_negative_sample():
    assert detect(NEGATIVE) is False
    det = identify(NEGATIVE)
    assert det == {}
