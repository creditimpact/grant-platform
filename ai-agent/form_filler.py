"""Smarter form filling utilities."""
import json
from pathlib import Path
from typing import Dict, Any
from datetime import datetime
from document_utils import extract_fields
import re

FORM_DIR = Path(__file__).parent / "form_templates"

ZIP_STATE = {
    "9": "CA",
    "1": "NY",
    "6": "IL",
}


def _fill_template(template: Dict[str, Any], data: Dict[str, Any]) -> Dict[str, Any]:
    fields = template.get("fields", {})
    optional = template.get("optional_fields", {})
    computed = template.get("computed_fields", {})
    conditional = template.get("conditional_fields", {})

    # evaluate computed fields in the context of data
    for key, expr in computed.items():
        try:
            ctx = dict(data)
            ctx["current_year"] = datetime.utcnow().year
            safe = {"__builtins__": {}, "int": int, "float": float}
            data[key] = eval(expr, safe, ctx)
        except Exception:
            data[key] = ""

    # derive state from zip if missing
    if "state" not in data and "zip" in data:
        z = str(data["zip"])
        for prefix, state in ZIP_STATE.items():
            if z.startswith(prefix):
                data["state"] = state
                break

    # simple conditional logic
    for key, rule in conditional.items():
        expr = rule.get("if")
        val = rule.get("value", True)
        try:
            if eval(expr, {"__builtins__": {}}, data):
                data[key] = val
        except Exception:
            pass

    merged = {}
    for k, default in fields.items():
        merged[k] = data.get(k, optional.get(k, "Unknown"))
    for k in conditional.keys():
        if k in data:
            merged[k] = data[k]

    template["fields"] = merged

    for section in template.get("sections", []):
        _fill_template(section, data)

    return template


def fill_form(form_key: str, data: Dict[str, Any], file_bytes: bytes | None = None) -> Dict[str, Any]:
    """Load ``form_key`` template and merge ``data`` into the fields."""
    if file_bytes:
        data.update(extract_fields(file_bytes))
    path = FORM_DIR / f"{form_key}.json"
    with path.open("r", encoding="utf-8") as f:
        template = json.load(f)
    return _fill_template(template, data)
