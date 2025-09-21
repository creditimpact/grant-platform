from __future__ import annotations

from pathlib import Path

import pytest

from src.detectors import identify
from src.extractors.payroll_register import detect as detect_payroll, extract as extract_payroll

FIXTURES = Path(__file__).resolve().parent / "fixtures"


def _read(name: str) -> str:
    return (FIXTURES / name).read_text()


@pytest.mark.parametrize(
    "fixture_name",
    [
        "payroll_register_adp.pdf",
        "payroll_register_gusto.pdf",
        "payroll_register_qb.csv",
        "payroll_register_paychex.xlsx",
    ],
)
def test_payroll_register_detection_variants(fixture_name: str) -> None:
    sample = _read(fixture_name)
    assert detect_payroll(sample) is True
    det = identify(sample)
    assert det
    assert det["type_key"] in {"Payroll_Register", "Payroll_Provider_Report"}
    assert det["confidence"] >= 0.5


def test_payroll_register_extraction_parses_employees() -> None:
    sample = _read("payroll_register_adp.pdf")
    result = extract_payroll(sample, evidence_key="uploads/adp.pdf")
    clean = result["fields_clean"]
    assert result["doc_type"] == "Payroll_Register"
    assert clean["employee_count"] == 2
    assert clean["pay_period"]["start_date"] == "2023-01-01"
    assert clean["pay_period"]["end_date"] == "2023-01-07"
    assert clean["pay_period"]["check_date"] == "2023-01-10"
    assert clean["pay_period"]["frequency"] in {"weekly", "biweekly", "semimonthly", "monthly", "unknown"}

    employees = clean["employees"]
    assert employees[0]["employee"]["name"] == "Jane Smith"
    assert employees[0]["employee"]["ssn_last4"] == "4321"
    assert employees[0]["pay_components"]["regular_pay"] == pytest.approx(1200.0)
    assert employees[0]["withholding"]["federal_wh"] == pytest.approx(200.0)
    assert employees[0]["net_pay"] == pytest.approx(1125.25)
    assert employees[0]["ytd"]["total_pay"] == pytest.approx(3000.0)

    totals = clean["document_totals"]
    assert totals["gross"] == pytest.approx(3300.0)
    assert totals["withholding"] == pytest.approx(837.45, rel=1e-3)
    assert totals["net"] == pytest.approx(2462.55, rel=1e-3)

    assert result["parse_summary"]["rows_parsed"] == 2
    assert result["vendor_guess"]["name"] == "ADP"
    assert result["field_sources"]["employees[0].employee.name"]["line"] > 0
    assert result["field_confidence"]["employees[0].employee.name"] >= 0.7
    assert isinstance(result["warnings"], list)


def test_payroll_register_gusto_frequency_and_totals() -> None:
    sample = _read("payroll_register_gusto.pdf")
    result = extract_payroll(sample)
    period = result["fields_clean"]["pay_period"]
    assert period["start_date"] == "2023-02-01"
    assert period["end_date"] == "2023-02-15"
    assert period["frequency"] == "biweekly"
    totals = result["fields_clean"]["document_totals"]
    assert totals["gross"] == pytest.approx(6130.0)
    assert totals["net"] == pytest.approx(4482.8, rel=1e-3)


def test_payroll_register_csv_detection_prefers_catalog_entry() -> None:
    sample = _read("payroll_register_qb.csv")
    det = identify(sample)
    assert det["type_key"] in {"Payroll_Register", "Payroll_Provider_Report"}
    out = extract_payroll(sample)
    assert out["fields_clean"]["employee_count"] == 2
    assert out["fields_clean"]["employees"][1]["employee"]["name"] == "Jamie Wong"


def test_payroll_register_missing_columns_warns() -> None:
    text = """Payroll Register\nEmployee Name,Gross Pay\nTotals,1000"""
    out = extract_payroll(text)
    assert any("Missing expected columns" in msg for msg in out["warnings"])
    assert out["parse_summary"]["columns_missing"]
