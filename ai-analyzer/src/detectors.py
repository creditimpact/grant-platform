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
    return out


DOC_TYPES = _load_doc_types()

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
