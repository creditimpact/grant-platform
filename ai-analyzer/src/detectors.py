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


CUSTOM_DETECTORS: Dict[str, Callable[[str], float]] = {
    "1099_NEC": _score_1099_nec,
    "Form1099_Summary": _score_1099_summary,
    "Vendor_1099_Report": _score_1099_summary,
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
        if custom:
            score = max(score, custom(text))
        if score > 0:
            score += spec["identify"].get("score_bonus", 0)
        if score > 0 and (not best or score > best["confidence"]):
            best = {"type_key": key, "confidence": float(score)}
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
        extracted = func(text)
    return {"type": {"key": key, "confidence": det.get("confidence", 0)}, "extracted": extracted}
