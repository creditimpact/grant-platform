"""Simple form filling utilities."""
import json
from pathlib import Path
from typing import Dict

FORM_DIR = Path(__file__).parent / "form_templates"


def fill_form(form_key: str, data: Dict[str, str]) -> Dict:
    """Load ``form_key`` template and merge ``data`` into the fields."""
    path = FORM_DIR / f"{form_key}.json"
    with path.open("r", encoding="utf-8") as f:
        template = json.load(f)
    fields = template.get("fields", {})
    fields.update(data)
    template["fields"] = fields
    return template
