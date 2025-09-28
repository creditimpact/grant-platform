from pathlib import Path

from src.extractors.veteran_cert_proof import extract

FIXTURES = Path(__file__).resolve().parent / "fixtures" / "veteran"


def _read(name: str) -> str:
    return (FIXTURES / name).read_text(encoding="utf-8")


def test_certificate_proof_fields():
    text = _read("certificate_sba.pdf")
    result = extract(text, "SDVOSB_Certificate")

    doc = result["fields_clean"]["veteranCert"]["doc"]
    proof = result["fields_clean"]["veteranCert"]["proof"]

    assert result["doc_type"] == "SDVOSB_Certificate"
    assert doc == {"type": "SDVOSB_Certificate", "issuer": "SBA", "program": "VetCert"}
    assert proof["businessName"]["value"] == "Valor Tech Industries LLC"
    assert proof["certificateId"]["value"] == "SBA-VC-123456"
    assert proof["issueDate"]["value"] == "2023-09-12"
    assert proof["validThrough"]["value"] == "2026-09-12"
    assert proof["certifiedAs"]["value"] == "SDVOSB"
    assert result["fields_clean"]["proof.status"] == "active"
    assert set(result["fields_clean"]["proof.naics"]) == {"541330", "541512"}


def test_approval_letter_status_pending():
    text = _read("approval_letter.pdf")
    result = extract(text, "VOSB_SDVOSB_Approval_Letter")
    assert result["doc_type"] == "VOSB_SDVOSB_Approval_Letter"
    assert result["fields_clean"]["proof.status"] == "pending"
    proof = result["fields_clean"]["veteranCert"]["proof"]
    assert proof["certifiedAs"]["value"] == "VOSB"
