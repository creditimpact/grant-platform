from pathlib import Path

from src.detectors import identify

FIXTURES = Path(__file__).resolve().parent / "fixtures" / "veteran"


def _read(name: str) -> str:
    return (FIXTURES / name).read_text(encoding="utf-8")


def test_detects_veteran_application():
    text = _read("application_aug2023.pdf")
    det = identify(text)
    assert det["type_key"] == "VOSB_SDVOSB_Application"
    assert det["confidence"] >= 0.7


def test_detects_sba_certificate():
    text = _read("certificate_sba.pdf")
    det = identify(text)
    assert det["type_key"] == "SDVOSB_Certificate"
    assert det["confidence"] >= 0.7


def test_detects_approval_letter():
    text = _read("approval_letter.pdf")
    det = identify(text)
    assert det["type_key"] == "VOSB_SDVOSB_Approval_Letter"
    assert det["confidence"] >= 0.6


def test_negative_tax_document_not_veteran_cert():
    text = _read("negative/random_tax_form.pdf")
    det = identify(text)
    assert det == {} or det.get("type_key") not in {
        "VOSB_SDVOSB_Application",
        "VOSB_Certificate",
        "SDVOSB_Certificate",
        "VOSB_SDVOSB_Approval_Letter",
    }
