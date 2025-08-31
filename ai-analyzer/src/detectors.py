from pathlib import Path
import json, re

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
}

def identify(doc_text: str) -> dict:
    """Return {'type_key': str, 'confidence': float} or {}"""
    text = doc_text[:20000]  # cap for speed
    best = None
    for key, spec in DOC_TYPES.items():
        kw = spec["identify"].get("keywords_any", [])
        rx = spec["identify"].get("regex_any", [])
        score = 0
        if any(k.lower() in text.lower() for k in kw):
            score += 0.5
        if any(re.search(r, text) for r in rx):
            score += 0.5
        if score > 0 and (not best or score > best["confidence"]):
            best = {"type_key": key, "confidence": score}
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
