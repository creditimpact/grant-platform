import json
from pathlib import Path

import pytest

from document_library import catalog_index

from main import analyze_text_flow


FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"
pytestmark = pytest.mark.anyio


@pytest.fixture
def anyio_backend():
    return "asyncio"


def _flatten_fields(payload):
    if not isinstance(payload, dict):
        return {}
    flat = {}
    for key, value in payload.items():
        if isinstance(value, dict):
            nested = _flatten_fields(value)
            for sub_key, sub_value in nested.items():
                flat[f"{key}.{sub_key}"] = sub_value
        else:
            flat[key] = value
    return flat


async def test_bank_statement_dynamic_flow():
    text = (FIXTURES_DIR / "bank_statement_sample.pdf").read_text(encoding="utf-8")
    session_id = "test_bank_dynamic"
    result = await analyze_text_flow(
        text,
        source="unit-test",
        filename="bank_statement_sample.pdf",
        content_type="application/pdf",
        session_id=session_id,
    )
    schema = list(catalog_index()["Bank_Statements"].schema_fields)
    assert result["doc_type"] == "Bank_Statements"
    assert result["schema_fields"] == schema
    flat_fields = _flatten_fields(result["fields"])
    assert set(flat_fields).issubset(set(schema))
    assert flat_fields["ending_balance"] == "54743.63"
    assert flat_fields["statement_period.start"] == "2025-06-01"
    assert flat_fields["statement_period.end"] == "2025-06-30"
    assert result["field_confidence"]["ending_balance"] >= 0.65
    debug_path = Path("/tmp/sessions") / session_id / "analyzer_debug.json"
    assert debug_path.exists()
    debug_data = json.loads(debug_path.read_text(encoding="utf-8"))
    assert debug_data["extractor"].endswith("Bank_Statements.extract")


async def test_profit_and_loss_dynamic_flow():
    text = (FIXTURES_DIR / "profit_and_loss_sample.pdf").read_text(encoding="utf-8")
    session_id = "test_pnl_dynamic"
    result = await analyze_text_flow(
        text,
        source="unit-test",
        filename="profit_and_loss_sample.pdf",
        content_type="application/pdf",
        session_id=session_id,
    )
    schema = list(catalog_index()["Profit_And_Loss_Statement"].schema_fields)
    assert result["doc_type"] == "Profit_And_Loss_Statement"
    assert result["schema_fields"] == schema
    flat_fields = _flatten_fields(result["fields"])
    assert set(flat_fields).issubset(set(schema))
    assert flat_fields["net_income"] == "50000"


async def test_business_license_dynamic_flow():
    text = (FIXTURES_DIR / "business_license_sample.pdf").read_text(encoding="utf-8")
    session_id = "test_license_dynamic"
    result = await analyze_text_flow(
        text,
        source="unit-test",
        filename="business_license_sample.pdf",
        content_type="application/pdf",
        session_id=session_id,
    )
    schema = list(catalog_index()["Business_License"].schema_fields)
    assert result["doc_type"] == "Business_License"
    assert result["schema_fields"] == schema
    assert set(result["fields"].keys()).issubset(set(schema))
    assert result["fields"]["business_name"] == "Doe Ventures"
