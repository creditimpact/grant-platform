from __future__ import annotations

from pathlib import Path

import pytest

from src.detectors import identify
from src.extractors.irs_1099_summary import (
    detect as detect_summary,
    extract_form1099_summary,
    extract_vendor_1099_report,
)

FIXTURES = Path(__file__).resolve().parent / "fixtures"


def _read(name: str) -> str:
    return (FIXTURES / name).read_text()


@pytest.mark.parametrize(
    "fixture_name",
    [
        "1099_summary_qb.csv",
        "1099_summary_gusto.pdf",
        "1099_summary_adp.xlsx",
    ],
)
def test_detects_summary_variants(fixture_name: str) -> None:
    sample = _read(fixture_name)
    assert detect_summary(sample) is True
    det = identify(sample)
    assert det["type_key"] in {"Form1099_Summary", "Vendor_1099_Report"}
    assert det["confidence"] >= 0.7


def test_extracts_quickbooks_csv() -> None:
    sample = _read("1099_summary_qb.csv")
    result = extract_form1099_summary(sample, evidence_key="uploads/qb.csv")
    clean = result["fields_clean"]
    contractors = clean["contractors"]
    assert len(contractors) == 2
    first = contractors[0]
    assert first["contractor"]["name"] == "Jamie Contractor"
    assert first["contractor"]["tin_last4"] == "6789"
    assert first["amounts"]["box1_nonemployee_comp"] == pytest.approx(5500.0)
    assert first["amounts"]["federal_wh"] == pytest.approx(500.0)
    totals = clean["totals"]
    assert totals["contractors_count"] == 2
    assert totals["sum_box1"] == pytest.approx(9700.5)
    assert totals["sum_federal_wh"] == pytest.approx(500.0)
    assert totals["sum_state_wh"] == pytest.approx(150.0)
    assert clean["vendor_guess"]["name"] == "QuickBooks"
    assert clean["tax_year"] == "2023"
    assert result["field_sources"]["contractors[0].contractor.name"]["raw"] == "Jamie Contractor"
    assert result["warnings"] == []


def test_extracts_gusto_pdf_totals() -> None:
    sample = _read("1099_summary_gusto.pdf")
    result = extract_vendor_1099_report(sample)
    clean = result["fields_clean"]
    assert clean["vendor_guess"]["name"] == "Gusto"
    contractors = clean["contractors"]
    assert contractors[1]["contractor"]["tin_last4"] == "3333"
    assert contractors[1]["amounts"]["federal_wh"] == pytest.approx(50.0)
    assert clean["totals"]["sum_box1"] == pytest.approx(6300.0)
    assert clean["totals"]["sum_state_wh"] == pytest.approx(120.0)
    assert clean["tax_year"] == "2022"


def test_missing_columns_and_invalid_tin_warn() -> None:
    sample = "Vendor,Name\nNo totals here"
    result = extract_form1099_summary(sample)
    assert "missing_box1_column" in result["warnings"]

    bad_tin = _read("1099_summary_qb.csv").replace("12-3456789", "12-3")
    result_bad = extract_form1099_summary(bad_tin)
    assert "invalid_tin_value" in result_bad["warnings"]
