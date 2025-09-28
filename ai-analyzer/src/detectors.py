from pathlib import Path
import json, re
from typing import Callable, Dict

CATALOG_DIR = Path(__file__).resolve().parents[2] / "shared" / "document_types"
CATALOG_PATH = CATALOG_DIR / "catalog.json"


def _load_doc_types() -> dict:
    with open(CATALOG_PATH, "r", encoding="utf-8") as f:
        raw = json.load(f)["types"]
    out = {}
    for key, spec in raw.items():
        if isinstance(spec, dict) and "$ref" in spec:
            ref_path = CATALOG_DIR / spec["$ref"]
            with open(ref_path, "r", encoding="utf-8") as rf:
                out[key] = json.load(rf)
        else:
            out[key] = spec
        if "detector" in out[key] and "identify" not in out[key]:
            det = out[key].pop("detector")
            out[key]["identify"] = {
                "keywords_any": det.get("keywords", []),
                "regex_any": det.get("regex", []),
            }
            if "score_bonus" in det:
                out[key]["identify"]["score_bonus"] = det["score_bonus"]
        if "identify" not in out[key]:
            out[key]["identify"] = {"keywords_any": [], "regex_any": []}
    return out


DOC_TYPES = _load_doc_types()

# map key -> (module, function)
EXTRACTORS = {
    "Form_1120X": ("irs_1120x", "extract"),
    "Tax_Payment_Receipt": ("tax_payment_receipt", "extract"),
    "IRS_941X": ("irs_941x", "extract"),
    "Business_License": ("business_license", "extract"),
    "Articles_Of_Incorporation": ("articles_of_incorporation", "extract"),
    "EIN_Letter": ("ein_letter", "extract"),
    "W9_Form": ("w9_form", "extract"),
    "W2_Form": ("w2_form", "extract"),
    "1099_NEC": ("irs_1099_nec", "extract"),
    "Form1099_Summary": ("irs_1099_summary", "extract_form1099_summary"),
    "Vendor_1099_Report": ("irs_1099_summary", "extract_vendor_1099_report"),
    "Profit_And_Loss_Statement": ("p_and_l_statement", "extract"),
    "Balance_Sheet": ("balance_sheet", "extract"),
    "Business_Plan": ("business_plan", "extract"),
    "Grant_Use_Statement": ("grant_use_statement", "extract"),
    "Utility_Bill": ("utility_bill", "extract"),
    "Installer_Contract": ("installer_contract", "extract"),
    "Equipment_Specs": ("equipment_specs", "extract"),
    "Invoices_or_Quotes": ("invoices_or_quotes", "extract"),
    "Energy_Savings_Report": ("energy_savings_report", "extract"),
    "Payroll_Register": ("payroll_register", "extract"),
    "Payroll_Provider_Report": ("payroll_register", "extract"),
    "DBE_ACDBE_Uniform_Application": ("dbe_acdbe_uniform_application", "extract"),
    "VOSB_SDVOSB_Application": ("veteran_cert_application", "extract"),
    "VOSB_Certificate": ("veteran_cert_proof", "extract"),
    "SDVOSB_Certificate": ("veteran_cert_proof", "extract"),
    "VOSB_SDVOSB_Approval_Letter": ("veteran_cert_proof", "extract"),
}


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


def identify(doc_text: str) -> dict:
    """Return {'type_key': str, 'confidence': float} or {}"""
    text = doc_text[:20000]  # cap for speed
    best = None
    lowered = text.lower()
    for key, spec in DOC_TYPES.items():
        kw = spec["identify"].get("keywords_any", [])
        rx = spec["identify"].get("regex_any", [])
        score = 0.0
        if any(k.lower() in lowered for k in kw):
            score += 0.5
        if any(re.search(r, text) for r in rx):
            score += 0.5
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
            score += spec["identify"].get("score_bonus", 0)
        candidate_key = override_key or key
        if score > 0 and (not best or score > best["confidence"]):
            best = {"type_key": candidate_key, "confidence": float(score)}
    return best or {}


def detect(text: str) -> dict:
    det = identify(text)
    if not det:
        return {"type": {}, "extracted": {}}
    key = det["type_key"]
    mod_name, func_name = EXTRACTORS.get(key, (None, None))
    extracted = {}
    if mod_name:
        mod = __import__(f"src.extractors.{mod_name}", fromlist=[func_name])
        func = getattr(mod, func_name)
        try:
            extracted = func(text, key)
        except TypeError:
            extracted = func(text)
    return {"type": {"key": key, "confidence": det.get("confidence", 0)}, "extracted": extracted}
