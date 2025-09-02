import os
from src.detectors import identify
from src.extractors.utility_bill import detect, extract


def load_sample():
    p = os.path.join(os.path.dirname(__file__), "fixtures", "utility_bill_sample.txt")
    with open(p, "r", encoding="utf-8") as f:
        return f.read()


def test_detect_utility_bill():
    text = load_sample()
    assert detect(text)
    det = identify(text)
    assert det["type_key"] == "Utility_Bill"
    assert det["confidence"] >= 0.5


def test_extract_utility_bill_fields():
    text = load_sample()
    result = extract(text)
    fields = result["fields"]
    assert fields["utility_provider"] == "ACME Energy Services"
    assert fields["service_address"].startswith("123 Green St")
    assert fields["billing_period_start"] == "2024-01-01"
    assert fields["billing_period_end"] == "2024-01-31"
    assert fields["total_kwh"] == 234.0
    assert fields["total_amount_due"] == 56.78
    assert fields["account_number"] == "12345-6789"
    assert fields["statement_date"] == "2024-02-02"
    assert result["confidence"] >= 0.8
