import pytest

from src.extractors.Bank_Statements import extract


@pytest.fixture
def sample_bank_pdf_text() -> str:
    return (
        "Bank of America Business Checking Statement\n"
        "Financial Institution: Bank of America\n"
        "Account Owner: Paulsson Inc.\n"
        "Account Number: ****1234\n"
        "Statement Period: 06/01/2025 - 06/30/2025\n"
        "Opening Balance: $12,540.00\n"
        "Total Credits Posted: $9,500.00\n"
        "Total Debits Posted: $3,300.00\n"
        "Closing Balance: $18,750.25\n"
        "Currency: USD\n"
    )


def test_extract_bank_statement_fields(sample_bank_pdf_text: str) -> None:
    result = extract(sample_bank_pdf_text)
    fields = result["fields"]
    assert fields["account_number_last4"] == "1234"
    assert fields["statement_period"]["start"] == "2025-06-01"
    assert fields["statement_period"]["end"] == "2025-06-30"
    assert fields["beginning_balance"] == "12540.00"
    assert fields["ending_balance"] == "18750.25"
    assert fields["totals"]["deposits"] == "9500.00"
    assert fields["totals"]["withdrawals"] == "3300.00"
    assert result["field_confidence"]["ending_balance"] >= 0.7
    assert result["confidence"] >= 0.6
