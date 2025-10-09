import pytest


@pytest.fixture
def extractor_module():
    from importlib import import_module

    return import_module("src.extractors.Bank_Statements")


def test_bank_statement_wellsfargo_compact_summary(extractor_module):
    sample_text = """
    Account number Beginning balance Total credits Total debits Ending balance
    1864314156 $31,648.12 $389,644.58 -$366,549.07 $54,743.63
    """

    fields = extractor_module.extract(sample_text)["fields"]

    assert fields["beginning_balance"] == "31648.12"
    assert fields["ending_balance"] == "54743.63"
    assert fields["totals"]["deposits"] == "389644.58"
    assert fields["totals"]["withdrawals"] == "366549.07"
