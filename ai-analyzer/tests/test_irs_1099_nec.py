from __future__ import annotations

from pathlib import Path

import pytest

from src.detectors import identify
from src.extractors.irs_1099_nec import detect as detect_1099_nec, extract

FIXTURES = Path(__file__).resolve().parent / "fixtures"
PDF_SAMPLE = (FIXTURES / "irs_1099_nec_copyB.pdf").read_text()
OCR_SAMPLE = (FIXTURES / "irs_1099_nec_ocr.txt").read_text()


def test_detects_1099_nec_variants() -> None:
    assert detect_1099_nec(PDF_SAMPLE) is True
    det = identify(PDF_SAMPLE)
    assert det["type_key"] == "1099_NEC"
    assert det["confidence"] >= 0.8

    det_ocr = identify(OCR_SAMPLE)
    assert det_ocr["type_key"] == "1099_NEC"
    assert det_ocr["confidence"] >= 0.7


def test_extracts_core_fields_with_masking() -> None:
    result = extract(PDF_SAMPLE, evidence_key="uploads/nec.pdf")
    clean = result["fields_clean"]
    assert result["doc_type"] == "1099_NEC"
    assert clean["payer_name"] == "Acme Services LLC"
    assert clean["payer_address"].startswith("123 Market Street")
    assert clean["payer_phone"] == "(312) 555-0199"
    assert clean["payer_tin"] == "123456789"
    assert clean["payer_tin_masked"] == "***-**-6789"
    assert clean["payer_tin_last4"] == "6789"
    assert clean["recipient_name"] == "Jamie Contractor"
    assert clean["recipient_tin"] == "987654321"
    assert clean["recipient_tin_masked"] == "***-**-4321"
    assert clean["recipient_tin_last4"] == "4321"
    assert clean["box1_nonemployee_comp"] == pytest.approx(5500.0)
    assert clean["box2_direct_sales_over_5000"] is True
    assert clean["box4_federal_income_tax_wh"] == pytest.approx(500.0)
    assert clean["box5_state_tax_wh"] == pytest.approx(150.0)
    assert clean["box6_state_payer_state_no"] == "IL-123456"
    assert clean["box7_state_income"] == pytest.approx(5500.0)
    assert clean["account_number"] == "ACCT-99"
    assert clean["corrected"] is True
    assert clean.get("void") in {False, None}
    assert clean["tax_year"] == "2023"

    assert result["field_sources"]["payer_tin"]["raw"].startswith("12-345")
    assert result["field_confidence"]["box1_nonemployee_comp"] >= 0.8
    assert not result["warnings"]


def test_ocr_variant_handles_parentheses_and_warnings() -> None:
    result = extract(OCR_SAMPLE)
    clean = result["fields_clean"]
    assert clean["tax_year"] == "2022"
    assert clean["payer_tin_masked"].endswith("4321")
    assert clean["recipient_tin_last4"] == "6789"
    assert clean["box3_excess_golden_parachute"] == pytest.approx(-150.0)
    assert clean["box2_direct_sales_over_5000"] is False
    assert clean["box5_state_tax_wh"] == pytest.approx(250.0)
    assert clean["box7_state_income"] == pytest.approx(12345.67)
    assert "missing_box1" not in result["warnings"]


def test_missing_box1_adds_warning() -> None:
    text = PDF_SAMPLE.replace("1 Nonemployee compensation $5,500.00\n", "1 Nonemployee compensation \n")
    result = extract(text)
    assert "missing_box1" in result["warnings"]
