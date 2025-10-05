import re
from typing import Callable, Dict, Optional

from document_library import normalize_key
from document_library.detectors import build_identify_map


DOC_TYPES = build_identify_map()


def _score_1099_nec(text: str) -> float:
    if not text:
        return 0.0
    lowered = text.lower()
    score = 0.0
    if "form 1099-nec" in lowered or "form 1099 nec" in lowered:
        score += 0.6
    if "nonemployee compensation" in lowered:
        score += 0.3
    if "omb no. 1545-0116" in lowered or "omb no 1545-0116" in lowered:
        score += 0.15
    if "copy a" in lowered or "copy b" in lowered:
        score += 0.1
    if "irs.gov/form1099nec" in lowered:
        score += 0.1
    if len(re.findall(r"(?im)^\s*[1-7]\s+", text)) >= 3:
        score += 0.1
    return min(score, 1.2)


def _score_1099_summary(text: str) -> float:
    if not text:
        return 0.0
    lowered = text.lower()
    score = 0.0
    if "1099 summary" in lowered or "vendor 1099" in lowered:
        score += 0.7
    if "nonemployee compensation" in lowered or "box 1" in lowered:
        score += 0.3
    if any(term in lowered for term in ("tin", "tax id", "ein")):
        score += 0.2
    if any(vendor in lowered for vendor in ("quickbooks", "gusto", "adp", "paychex", "intuit")):
        score += 0.2
    return min(score, 1.1)


def _score_veteran_documents(text: str) -> Dict[str, float | str]:
    lowered = text.lower()
    if not lowered:
        return {"score": 0.0}

    issuer_terms = [
        "veteran small business certification",
        "vetcert",
        "vosb",
        "sdvosb",
        "u.s. small business administration",
        "small business administration",
        "department of veterans affairs",
        "osdbu",
        "cve",
    ]
    application_terms = [
        "certification application",
        "application packet",
        "ownership and control",
        "dd-214",
        "service-connected disability",
        "eligibility questionnaire",
    ]
    certificate_terms = [
        "this certifies that",
        "has been verified",
        "certification valid through",
        "certificate id",
        "verified",
        "certificate number",
    ]
    letter_terms = [
        "approval letter",
        "verification letter",
        "approval notice",
        "under review",
        "pending",
    ]

    negative_terms = [
        "form w-2",
        "wage and tax statement",
        "form 1099",
        "nonemployee compensation",
        "form 941-x",
        "disadvantaged business enterprise",
        "uniform certification application",
    ]

    score = 0.0
    issuer_hits = sum(1 for term in issuer_terms if term in lowered)
    score += min(issuer_hits * 0.2, 0.6)

    has_application = any(term in lowered for term in application_terms)
    has_certificate = any(term in lowered for term in certificate_terms)
    has_letter = any(term in lowered for term in letter_terms)

    if has_application:
        score += 0.35
    if has_certificate:
        score += 0.4
    if has_letter:
        score += 0.25

    if "service-disabled" in lowered or "service disabled" in lowered:
        score += 0.1

    if any(term in lowered for term in negative_terms):
        score -= 0.5

    score = max(score, 0.0)

    doc_type = None
    if has_letter:
        doc_type = "VOSB_SDVOSB_Approval_Letter"
    elif has_certificate:
        if "service-disabled" in lowered or "service disabled" in lowered:
            doc_type = "SDVOSB_Certificate"
        else:
            doc_type = "VOSB_Certificate"
    elif has_application and score >= 0.5:
        doc_type = "VOSB_SDVOSB_Application"

    return {"score": score, "type_key": doc_type} if doc_type else {"score": score}


CUSTOM_DETECTORS: Dict[str, Callable[[str], float | Dict[str, float | str]]] = {
    "1099_NEC": _score_1099_nec,
    "Form1099_Summary": _score_1099_summary,
    "Vendor_1099_Report": _score_1099_summary,
    "VOSB_SDVOSB_Application": _score_veteran_documents,
    "VOSB_Certificate": _score_veteran_documents,
    "SDVOSB_Certificate": _score_veteran_documents,
    "VOSB_SDVOSB_Approval_Letter": _score_veteran_documents,
}
def identify(doc_text: str, *, filename: Optional[str] = None) -> dict:
    """Return {'type_key': str, 'confidence': float} or {}"""

    text = doc_text[:20000] if doc_text else ""
    best = None
    lowered = text.lower()
    lowered_filename = filename.lower() if filename else None

    for key, spec in DOC_TYPES.items():
        identify_spec = spec.get("identify", {})
        kw = identify_spec.get("keywords_any", [])
        rx = identify_spec.get("regex_any", [])
        filename_terms = identify_spec.get("filename_contains", [])

        score = 0.0
        text_hits = [term for term in kw if term.lower() in lowered]
        if text_hits:
            score += 0.5
            score += min(0.3, 0.1 * (len(text_hits) - 1))

        if rx and any(re.search(r, text) for r in rx):
            score += 0.5

        if lowered_filename and filename_terms:
            if any(term.lower() in lowered_filename for term in filename_terms):
                score += 0.2

        custom = CUSTOM_DETECTORS.get(key)
        override_key = None
        if custom:
            custom_res = custom(text)
            if isinstance(custom_res, dict):
                score = max(score, float(custom_res.get("score", 0.0)))
                override_key = custom_res.get("type_key")
            else:
                score = max(score, float(custom_res))

        if score > 0:
            score += identify_spec.get("score_bonus", 0)

        candidate_key = normalize_key(override_key or key)
        if score > 0 and (not best or score > best["confidence"]):
            best = {"type_key": candidate_key, "confidence": float(score)}

    return best or {}


def detect(text: str, *, filename: Optional[str] = None) -> dict:
    det = identify(text, filename=filename)
    if not det:
        return {"type": {}}
    return {"type": {"key": det["type_key"], "confidence": det.get("confidence", 0.0)}}
