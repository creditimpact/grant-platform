from pathlib import Path
import sys

sys.path.append(str(Path(__file__).resolve().parent.parent))

from veteran_rules import evaluate_sdv, evaluate_vosb


def _base_payload():
    return {
        "owners_list": [
            {"name": "Jordan", "percent": 60, "isVeteran": True, "isSDV": True},
            {"name": "Avery", "percent": 40, "isVeteran": False, "isSDV": False},
        ],
        "control.signsChecks": True,
        "control.executesContracts": True,
        "veteran.proofs.dd214Present": True,
        "veteran.proofs.vaLetterPresent": True,
        "veteran.disabilityPercent": 70,
        "veteran.cert.status": "active",
    }


def test_vosb_eligible_with_active_certificate():
    payload = _base_payload()
    result = evaluate_vosb(payload)
    assert result["decision"] == "eligible"
    assert "veteran_ownership_met" in result["reasons"]
    assert result["missing"] == []


def test_sdv_eligible_with_letter():
    payload = _base_payload()
    result = evaluate_sdv(payload)
    assert result["decision"] == "eligible"
    assert "sdv_ownership_met" in result["reasons"]
    assert "certificate_active" in result["reasons"]


def test_sdv_conditional_without_va_letter():
    payload = _base_payload()
    payload["veteran.proofs.vaLetterPresent"] = False
    payload["veteran.disabilityPercent"] = 0
    payload["veteran.cert.status"] = "pending"
    result = evaluate_sdv(payload)
    assert result["decision"] == "conditional"
    assert "need_va_disability_letter" in result["reasons"]
    assert "need_va_disability_letter" in result["missing"]


def test_ineligible_when_ownership_below_threshold():
    payload = _base_payload()
    payload["owners_list"][0]["percent"] = 50
    payload["veteran.cert.status"] = "expired"
    result_vosb = evaluate_vosb(payload)
    assert result_vosb["decision"] == "ineligible"
    assert "ownership_below_51" in result_vosb["reasons"]
    result_sdv = evaluate_sdv(payload)
    assert result_sdv["decision"] == "ineligible"
    assert "sdv_ownership_below_51" in result_sdv["reasons"]
    assert "certificate_expired" in result_sdv["reasons"]
