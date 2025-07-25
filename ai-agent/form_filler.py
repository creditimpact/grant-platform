"""Smarter form filling utilities."""
import json
from pathlib import Path
from typing import Dict, Any
from datetime import datetime
from document_utils import extract_fields, guess_attachment
from nlp_utils import normalize_text_field

FORM_DIR = Path(__file__).parent / "form_templates"

ZIP_STATE = {
    "9": "CA",
    "1": "NY",
    "6": "IL",
}


def _generate_text(data: Dict[str, Any]) -> str:
    """Create a simple free text description based on available fields."""
    parts = ["Our"]
    if "industry" in data:
        parts.append(f"{data['industry']}")
    parts.append("business")
    if "employees" in data:
        parts.append(f"with {data['employees']} employees")
    if "city" in data:
        parts.append(f"based in {data['city']}")
    return " ".join(parts) + "."


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

    merged: Dict[str, Any] = {}
    attachments: Dict[str, str] = {}
    for k, spec in fields.items():
        if isinstance(spec, dict):
            default = spec.get("default", "")
            required = spec.get("required", True)
            ftype = spec.get("type", "text")
            depends = spec.get("depends_on")
            prompt = spec.get("prompt")
        else:
            default = spec
            required = True
            ftype = "text"
            depends = None
            prompt = None

        if depends and not data.get(depends):
            continue

        value = data.get(k)
        if isinstance(value, str):
            _, value = normalize_text_field(k, value)
        if value is None:
            value = optional.get(k, default if not required else "")

        if ftype == "text" and not value:
            value = _generate_text(data) if prompt is not None else ""
        elif ftype == "file_upload" and not value:
            guess = guess_attachment(k)
            if guess:
                attachments[k] = guess
                value = guess.split("/")[-1]

        merged[k] = value
    for k in conditional.keys():
        if k in data:
            merged[k] = data[k]

    template["fields"] = merged
    if attachments:
        template.setdefault("files", {}).update(attachments)

    for section in template.get("sections", []):
        child = _fill_template(section, data)
        if child.get("files"):
            template.setdefault("files", {}).update(child["files"])

    return template


def fill_form(form_key: str, data: Dict[str, Any], file_bytes: bytes | None = None) -> Dict[str, Any]:
    """Load ``form_key`` template and merge ``data`` into the fields."""
    if file_bytes:
        data.update(extract_fields(file_bytes))
    path = FORM_DIR / f"{form_key}.json"
    with path.open("r", encoding="utf-8") as f:
        template = json.load(f)
    return _fill_template(template, data)
