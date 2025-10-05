import pytest

from src.extractors.bank_statement import extract_fields


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
    result = extract_fields(sample_bank_pdf_text)
    assert result["bank_name"] == "Bank of America"
    assert result["account_holder_name"] == "Paulsson Inc."
    assert result["account_number_last4"] == "1234"
    assert result["statement_period"]["start"] == "06/01/2025"
    assert result["statement_period"]["end"] == "06/30/2025"
    assert result["beginning_balance"] == "12540.00"
    assert result["ending_balance"] == "18750.25"
    assert result["totals"]["deposits"] == "9500.00"
    assert result["totals"]["withdrawals"] == "3300.00"
    assert result["currency"] == "USD"
