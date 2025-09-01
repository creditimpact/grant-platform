from src.detectors import identify
from src.extractors.p_and_l_statement import detect, extract

SAMPLE = """Profit and Loss Statement
For the period Jan 1, 2024 - Dec 31, 2024
Total Revenue $500,000
Cost of Goods Sold $200,000
Gross Profit $300,000
Total Expenses $250,000
Net Income $50,000
"""

NEGATIVE = "This document discusses future plans only."


def test_detect_and_extract():
    assert detect(SAMPLE) is True
    det = identify(SAMPLE)
    assert det["type_key"] == "Profit_And_Loss_Statement"
    out = extract(SAMPLE, "pnl.pdf")
    assert out["doc_type"] == "Profit_And_Loss_Statement"
    fields = out["fields"]
    assert fields["period_start"] == "2024-01-01"
    assert fields["period_end"] == "2024-12-31"
    assert fields["total_revenue"] == 500000.0
    assert fields["net_income"] == 50000.0


def test_negative_sample():
    assert detect(NEGATIVE) is False
    det = identify(NEGATIVE)
    assert det == {}
