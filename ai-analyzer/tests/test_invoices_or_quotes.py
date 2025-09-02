import os
from pathlib import Path

from src.detectors import identify
from src.extractors.invoices_or_quotes import detect, extract

FIXTURES = Path(__file__).resolve().parent / "fixtures"


def load(name: str) -> str:
    with open(FIXTURES / name, "r", encoding="utf-8") as f:
        return f.read()


def test_invoice_detection_and_extraction():
    text = load("invoice_sample.txt")
    assert detect(text)
    det = identify(text)
    assert det["type_key"] == "Invoices_or_Quotes"
    out = extract(text)
    assert out["doc_type"] == "Invoices_or_Quotes"
    fields = out["fields"]
    assert fields["doc_variant"] == "invoice"
    assert fields["invoice_number"] == "INV-1001"
    assert fields["issue_date"] == "2025-01-05"
    assert fields["total_amount"] == 5400.0
    assert fields["vendor_name"] == "ACME Solar Corp"
    assert fields["customer_name"] == "Green Energy LLC"
    assert out["confidence"] >= 0.8


def test_quote_detection_and_extraction():
    text = load("quote_sample.txt")
    assert detect(text)
    det = identify(text)
    assert det["type_key"] == "Invoices_or_Quotes"
    out = extract(text)
    fields = out["fields"]
    assert fields["doc_variant"] == "quote"
    assert fields["quote_number"] == "Q-2002"
    assert fields["quote_valid_until"] == "2025-03-31"
    assert fields["total_amount"] == 1728.0
    assert fields["vendor_name"] == "Sunshine Installers"
    assert fields["customer_name"] == "Green Energy LLC"
    assert out["confidence"] >= 0.8


def test_negative_sample():
    text = load("business_plan_sample.txt")
    assert not detect(text)
    det = identify(text)
    assert det.get("type_key") != "Invoices_or_Quotes"
