"""Eligibility helpers for Veteran certification programs."""

from __future__ import annotations

from typing import Any, Dict, List, Optional


def _to_bool(value: Any) -> Optional[bool]:
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in {"", "unknown", "na", "n/a"}:
            return None
        if lowered in {"true", "yes", "y", "1"}:
            return True
        if lowered in {"false", "no", "n", "0"}:
            return False
    return bool(value)


def _to_float(value: Any) -> float:
    if value is None:
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        cleaned = value.strip().replace("%", "")
        try:
            return float(cleaned)
        except ValueError:
            return 0.0
    return 0.0


def _collect_context(data: Dict[str, Any]) -> Dict[str, Any]:
    owners = data.get("owners_list") or data.get("owners") or []
    max_veteran_pct = 0.0
    max_sdv_pct = 0.0
    for owner in owners:
        pct = _to_float(owner.get("percent") or owner.get("ownershipPct"))
        if _to_bool(owner.get("isVeteran")):
            max_veteran_pct = max(max_veteran_pct, pct)
        if _to_bool(owner.get("isSDV")) or _to_bool(owner.get("isServiceDisabledVeteran")):
            max_sdv_pct = max(max_sdv_pct, pct)
    control_signs = _to_bool(data.get("control.signsChecks"))
    control_executes = _to_bool(data.get("control.executesContracts"))
    dd214 = _to_bool(data.get("veteran.proofs.dd214Present"))
    va_letter = _to_bool(data.get("veteran.proofs.vaLetterPresent"))
    disability_percent = _to_float(data.get("veteran.disabilityPercent"))
    proof_status = (data.get("veteran.cert.status") or "").strip().lower() or None
    return {
        "owners": owners,
        "max_veteran_pct": max_veteran_pct,
        "max_sdv_pct": max_sdv_pct,
        "control_signs": control_signs,
        "control_executes": control_executes,
        "dd214": dd214,
        "va_letter": va_letter,
        "disability_percent": disability_percent,
        "proof_status": proof_status,
    }


def evaluate_vosb(data: Dict[str, Any]) -> Dict[str, Any]:
    ctx = _collect_context(data)
    reasons: List[str] = []
    missing: List[str] = []
    decision = "eligible"

    if ctx["max_veteran_pct"] >= 51:
        reasons.append("veteran_ownership_met")
    else:
        decision = "ineligible"
        reasons.append("ownership_below_51")

    if not (ctx["control_signs"] and ctx["control_executes"]):
        decision = "ineligible"
        reasons.append("control_not_demonstrated")

    status = ctx["proof_status"]
    if status in {"expired", "revoked"}:
        decision = "ineligible"
        reasons.append(f"certificate_{status}")
    elif status == "active" and decision == "eligible":
        reasons.append("certificate_active")
    else:
        if ctx["dd214"]:
            if decision == "eligible":
                decision = "conditional"
            reasons.append("dd214_present_pending_certificate")
            missing.append("submit_active_certificate")
        else:
            if decision == "eligible":
                decision = "conditional"
            reasons.append("missing_service_proof")
            missing.append("provide_dd214_or_certificate")

    return {"decision": decision, "reasons": reasons, "missing": sorted(set(missing))}


def evaluate_sdv(data: Dict[str, Any]) -> Dict[str, Any]:
    ctx = _collect_context(data)
    reasons: List[str] = []
    missing: List[str] = []
    decision = "eligible"

    if ctx["max_sdv_pct"] >= 51:
        reasons.append("sdv_ownership_met")
    else:
        decision = "ineligible"
        reasons.append("sdv_ownership_below_51")

    if not (ctx["control_signs"] and ctx["control_executes"]):
        decision = "ineligible"
        reasons.append("control_not_demonstrated")

    letter_ok = ctx["va_letter"] or ctx["disability_percent"] > 0
    if not letter_ok:
        if decision == "eligible":
            decision = "conditional"
        reasons.append("need_va_disability_letter")
        missing.append("need_va_disability_letter")

    status = ctx["proof_status"]
    if status in {"expired", "revoked"}:
        decision = "ineligible"
        reasons.append(f"certificate_{status}")
    elif status == "active" and decision == "eligible":
        reasons.append("certificate_active")
    else:
        if ctx["dd214"] and letter_ok:
            if decision == "eligible":
                decision = "conditional"
            reasons.append("awaiting_active_certificate")
            missing.append("submit_active_certificate")
        elif ctx["dd214"]:
            if decision == "eligible":
                decision = "conditional"
            reasons.append("dd214_present_pending_certificate")
            if "need_va_disability_letter" not in missing:
                missing.append("need_va_disability_letter")
        else:
            if decision == "eligible":
                decision = "conditional"
            reasons.append("missing_service_proof")
            missing.append("provide_dd214")

    return {"decision": decision, "reasons": reasons, "missing": sorted(set(missing))}

