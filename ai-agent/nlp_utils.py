import re
from datetime import datetime
from typing import Dict, Tuple, Any

# Simple synonyms that map human terminology to data fields
SYNONYMS = {
    "headcount": "employees",
    "team_size": "employees",
    "founded": "business_age_years",
    "years_in_business": "business_age_years",
}

BOOLEAN_HINTS = {
    "woman": ("owner_gender", "female"),
    "female founder": ("owner_gender", "female"),
    "minority": ("owner_minority", True),
    "veteran": ("owner_veteran", True),
}

NUMBER_RE = re.compile(r"(?i)(\$?\d+[\d,]*\.?\d*\s*(?:k|m)?)")

def _parse_number(text: str) -> Any:
    text = text.replace(",", "").lower().strip()
    if text.startswith("$"):
        text = text[1:]
    if text.endswith("k"):
        try:
            return int(float(text[:-1]) * 1000)
        except ValueError:
            return None
    if text.endswith("m"):
        try:
            return int(float(text[:-1]) * 1000000)
        except ValueError:
            return None
    try:
        if text.startswith("$"):
            text = text[1:]
        if "." in text:
            return float(text)
        return int(text)
    except ValueError:
        return None


def normalize_text_field(field_name: str, raw_value: str) -> Tuple[str, Any]:
    """Normalize a single text field into canonical name and value."""
    canonical = SYNONYMS.get(field_name.lower(), field_name)
    value = raw_value
    if isinstance(raw_value, str):
        lowered = raw_value.strip().lower()
        # boolean type heuristics
        if lowered in {"yes", "true", "1", "y"}:
            value = True
        elif lowered in {"no", "false", "0", "n"}:
            value = False
        else:
            num_match = NUMBER_RE.match(lowered)
            if num_match:
                num = _parse_number(num_match.group(1))
                if num is not None:
                    value = num
    return canonical, value


def infer_field_from_text(text: str) -> Dict[str, Any]:
    """Infer structured fields from a blob of text."""
    result: Dict[str, Any] = {}
    blob = text.lower()
    for hint, (key, val) in BOOLEAN_HINTS.items():
        if hint in blob:
            result[key] = val
    # employees extraction
    m = re.search(r"(\d+)\s+(?:employees|staff|workers)", blob)
    if m:
        result["employees"] = int(m.group(1))
    # business age / founding year
    m = re.search(r"founded\s+(\d{4})", blob)
    if m:
        year = int(m.group(1))
        result["business_age_years"] = datetime.utcnow().year - year
    return result
