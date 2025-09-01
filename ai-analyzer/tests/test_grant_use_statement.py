from src.detectors import identify
from src.extractors.grant_use_statement import extract

POSITIVE = """Statement of Intended Use of Grant Funds\nFunding Request: $50,000\nPlanned Use of Funds:\n- payroll\nJustification: Retain staff\nDate: 01/15/2024"""

NEGATIVE = "Random unrelated text without keywords"


def test_detect_grant_use_statement():
    det = identify(POSITIVE)
    assert det["type_key"] == "Grant_Use_Statement"
    result = extract(POSITIVE)
    fields = result["fields"]
    assert fields["funding_request_amount"] == 50000
    assert "payroll" in fields.get("intended_categories", [])


def test_negative_case():
    det = identify(NEGATIVE)
    assert det == {} or det.get("type_key") != "Grant_Use_Statement"
