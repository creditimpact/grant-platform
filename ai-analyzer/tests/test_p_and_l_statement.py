from src.detectors import identify
from src.extractors.Profit_And_Loss_Statement import extract

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
    det = identify(SAMPLE)
    assert det["type_key"] == "Profit_And_Loss_Statement"
    fields = extract(SAMPLE)
    assert fields["period_start"] == "2024-01-01"
    assert fields["period_end"] == "2024-12-31"
    assert fields["total_revenue"] == "500000"
    assert fields["net_income"] == "50000"


def test_negative_sample():
    det = identify(NEGATIVE)
    assert det == {}
