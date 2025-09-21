from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from ai_analyzer.main import app
from src.detectors import identify
from src.extractors.w2_form import detect as detect_w2, extract

FIXTURES = Path(__file__).resolve().parent / "fixtures"
PDF_SAMPLE = (FIXTURES / "w2_sample_pdf.txt").read_text()
OCR_SAMPLE = (FIXTURES / "w2_sample_ocr.txt").read_text()

client = TestClient(app)


def test_detects_w2_pdf_sample() -> None:
    assert detect_w2(PDF_SAMPLE) is True
    det = identify(PDF_SAMPLE)
    assert det["type_key"] == "W2_Form"
    assert det["confidence"] >= 0.5


def test_extracts_structured_fields_from_pdf() -> None:
    out = extract(PDF_SAMPLE, evidence_key="uploads/w2.pdf")
    assert out["doc_type"] == "W2_Form"
    clean = out["fields_clean"]
    assert clean["ein"] == "123456789"
    assert clean["employee_ssn"] == "123456789"
    assert clean["employee_ssn_masked"] == "***-**-6789"
    assert clean["employee_name"] == "John Q Worker"
    assert clean["employer_name"] == "Acme Corporation"
    assert clean["box1_wages"] == pytest.approx(55000.0)
    assert clean["box2_federal_income_tax_withheld"] == pytest.approx(6500.0)
    assert clean["box12"] == [
        {"code": "D", "amount": 1500.0},
        {"code": "DD", "amount": 3200.0},
    ]
    assert clean["box13_statutory_employee"] is True
    assert clean["box13_retirement_plan"] is False
    assert clean["box13_third_party_sick_pay"] is False
    assert clean["box14_other"][0]["label"].lower() == "union dues"
    assert clean["box15_state"] == "NY"
    assert clean["box17_state_income_tax"] == pytest.approx(2200.0)
    assert clean["box20_locality_name"] == "Gotham"

    assert out["field_sources"]["ein"]["box"].lower() == "b"
    assert out["field_sources"]["box1_wages"]["box"] == "1"
    assert out["field_confidence"]["box1_wages"] >= 0.7
    assert out["warnings"] == []


def test_ocr_variant_parses_multiple_box12_entries() -> None:
    out = extract(OCR_SAMPLE)
    clean = out["fields_clean"]
    assert clean["ein"] == "987654321"
    assert clean["employee_ssn_masked"] == "***-**-4321"
    assert clean["box12"] == [
        {"code": "E", "amount": 900.0},
        {"code": "DD", "amount": 2800.0},
        {"code": "D", "amount": 450.0},
    ]
    assert clean["box13_retirement_plan"] is True
    assert clean.get("box13_statutory_employee") is False
    assert clean["box17_state_income_tax"] == pytest.approx(1800.0)
    assert out["confidence"] >= 0.75


def test_analyze_endpoint_exposes_metadata() -> None:
    resp = client.post("/analyze", json={"text": PDF_SAMPLE})
    assert resp.status_code == 200
    data = resp.json()
    assert data["doc_type"] == "W2_Form"
    assert data["fields_clean"]["ein"] == "123456789"
    assert data["field_sources"]["box2_federal_income_tax_withheld"]["box"] == "2"
    assert data["field_confidence"]["box2_federal_income_tax_withheld"] >= 0.7


def test_missing_ein_yields_warning() -> None:
    text = PDF_SAMPLE.replace("Employer identification number (EIN) 12-3456789\n", "")
    out = extract(text)
    assert any("EIN" in warning for warning in out["warnings"])
    assert out["confidence"] < 0.9


def test_detect_requires_multiple_clues() -> None:
    random_text = "This is not a tax form. It only mentions wages without context."
    assert detect_w2(random_text) is False
    assert identify(random_text) == {}
