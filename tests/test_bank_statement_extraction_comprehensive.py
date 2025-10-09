from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT / "ai-analyzer") not in sys.path:
    sys.path.append(str(ROOT / "ai-analyzer"))

from src.extractors.Bank_Statements import extract  # noqa: E402


LOG_PATH = Path("/tmp/session_diagnostics/bank_statement_extraction.log")


def _read_log() -> str:
    if LOG_PATH.exists():
        return LOG_PATH.read_text(encoding="utf-8")
    return ""


def _reset_log() -> None:
    if LOG_PATH.exists():
        LOG_PATH.write_text("", encoding="utf-8")


def test_paulsson_statement_fields_and_log() -> None:
    _reset_log()
    text = (
        "WELLS FARGO BUSINESS CHECKING STATEMENT\n"
        "Account Summary\n"
        "Account Number: ************4156\n"
        "Statement Period: Nov 1 - Nov 30, 2024\n"
        "Beginning Balance: $31,648.12\n"
        "Total Credits: $389,644.58\n"
        "Total Debits: $366,549.07\n"
        "Ending Balance: $54,743.63\n"
    )

    result = extract(text)
    fields = result["fields"]
    assert fields["account_number_last4"] == "4156"
    assert fields["statement_period"]["start"] == "2024-11-01"
    assert fields["statement_period"]["end"] == "2024-11-30"
    assert fields["beginning_balance"] == "31648.12"
    assert fields["ending_balance"] == "54743.63"
    assert fields["totals"]["deposits"] == "389644.58"
    assert fields["totals"]["withdrawals"] == "366549.07"
    assert result["field_confidence"]["ending_balance"] >= 0.8
    assert result["confidence"] >= 0.7

    log_contents = _read_log()
    assert "Extracted beginning_balance=$31,648.12, ending_balance=$54,743.63" in log_contents
    assert "Detected statement period: Nov 1" in log_contents


def test_wells_fargo_business_statement_variation() -> None:
    text = (
        "WELLS FARGO BANK, N.A.\n"
        "Account Ending In 9981\n"
        "Statement Cycle 10/01/2024 – 10/31/2024\n"
        "Opening balance $12,345.00\n"
        "Credits Total $15,000.50\n"
        "Total Checks Paid $7,500.25\n"
        "Closing Balance $19,845.25\n"
    )

    result = extract(text)
    fields = result["fields"]
    assert fields["account_number_last4"] == "9981"
    assert fields["statement_period"]["start"] == "2024-10-01"
    assert fields["statement_period"]["end"] == "2024-10-31"
    assert fields["beginning_balance"] == "12345.00"
    assert fields["ending_balance"] == "19845.25"
    assert fields["totals"]["deposits"] == "15000.50"
    assert fields["totals"]["withdrawals"] == "7500.25"
    assert result["field_confidence"]["totals.deposits"] >= 0.7


def test_chase_checking_statement_aliases() -> None:
    text = (
        "CHASE BUSINESS CHECKING\n"
        "Acct No: 123-456789-2222\n"
        "Period Covered From 10/05/2024 To 11/03/2024\n"
        "Start Balance $8,250.15\n"
        "Deposits $22,510.40\n"
        "Withdrawals $20,300.25\n"
        "End Balance $10,460.30\n"
    )

    result = extract(text)
    fields = result["fields"]
    assert fields["account_number_last4"] == "2222"
    assert fields["statement_period"]["start"] == "2024-10-05"
    assert fields["statement_period"]["end"] == "2024-11-03"
    assert fields["beginning_balance"] == "8250.15"
    assert fields["ending_balance"] == "10460.30"
    assert fields["totals"]["deposits"] == "22510.40"
    assert fields["totals"]["withdrawals"] == "20300.25"


def test_regex_minimal_snippet_matches() -> None:
    text = (
        "Account # Ending In 7777\n"
        "Statement Period 2024-01-01 to 2024-01-31\n"
        "Opening Balance $1,000.00\n"
        "Total credits $250.00\n"
        "Total debits $125.00\n"
        "Closing balance $1,125.00\n"
    )

    result = extract(text)
    fields = result["fields"]
    assert fields["account_number_last4"] == "7777"
    assert fields["statement_period"]["start"] == "2024-01-01"
    assert fields["statement_period"]["end"] == "2024-01-31"
    assert fields["beginning_balance"] == "1000.00"
    assert fields["ending_balance"] == "1125.00"
    assert fields["totals"]["deposits"] == "250.00"
    assert fields["totals"]["withdrawals"] == "125.00"

