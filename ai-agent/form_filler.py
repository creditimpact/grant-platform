"""Smarter form filling utilities."""
import json
from pathlib import Path
from typing import Dict, Any
from datetime import datetime

FORM_DIR = Path(__file__).parent / "form_templates"


def _fill_template(template: Dict[str, Any], data: Dict[str, Any]) -> Dict[str, Any]:
    fields = template.get("fields", {})
    optional = template.get("optional_fields", {})
    computed = template.get("computed_fields", {})

    # evaluate computed fields in the context of data
    for key, expr in computed.items():
        try:
            ctx = dict(data)
            ctx["current_year"] = datetime.utcnow().year
            data[key] = eval(expr, {"__builtins__": {}}, ctx)
        except Exception:
            data[key] = ""

    merged = {}
    for k, default in fields.items():
        merged[k] = data.get(k, optional.get(k, "Unknown"))

    template["fields"] = merged

    for section in template.get("sections", []):
        _fill_template(section, data)

    return template


def fill_form(form_key: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """Load ``form_key`` template and merge ``data`` into the fields."""
    path = FORM_DIR / f"{form_key}.json"
    with path.open("r", encoding="utf-8") as f:
        template = json.load(f)
    return _fill_template(template, data)
