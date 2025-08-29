from src.detectors import identify
from src.extractors.tax_payment_receipt import extract

SAMPLE = """
IRS Payment Confirmation
Payment Confirmation Number: ABC12345
Amount of Payment $1,234.56
Payment Date Submitted 2023-04-15
"""

def test_detect_tax_payment_receipt():
    det = identify(SAMPLE)
    assert det["type_key"] == "Tax_Payment_Receipt"
    assert det["confidence"] >= 0.5


def test_extract_fields():
    fields = extract(SAMPLE)
    assert fields["confirmation_number"] == "ABC12345"
    assert fields["payment_amount"] == 1234.56
    assert fields["payment_date"] == "2023-04-15"
    assert fields["payment_type"] == "federal"
