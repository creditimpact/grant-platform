import re
from datetime import datetime
from typing import Dict, Tuple, Any

# Simple synonyms that map human terminology to data fields
SYNONYMS = {
    "headcount": "employees",
    "team_size": "employees",
    "number_of_staff": "employees",
    "staff_size": "employees",
    "biz_age": "business_age_years",
    "business_age": "business_age_years",
    "founded": "business_age_years",
    "years_in_business": "business_age_years",
    "credit": "owner_credit_score",
    "credit_score": "owner_credit_score",
}

BOOLEAN_HINTS = {
    "woman": ("owner_gender", "female"),
    "woman-led": ("owner_gender", "female"),
    "women-led": ("owner_gender", "female"),
    "female founder": ("owner_gender", "female"),
    "woman owned": ("owner_gender", "female"),
    "minority": ("owner_minority", True),
    "minority-owned": ("owner_minority", True),
    "veteran": ("owner_veteran", True),
    "veteran-owned": ("owner_veteran", True),
}

NUMBER_RE = re.compile(r"(?i)(\$?\d+[\d,]*\.?\d*\s*(?:k|m)?)")


def resolve_field_name(name: str) -> str:
    """Return a canonical field name using synonyms and simple heuristics."""
    key = name.lower().replace(" ", "_")
    return SYNONYMS.get(key, key)

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


def parse_user_phrase(phrase: str) -> Dict[str, Any]:
    """Interpret a short natural language phrase and infer data fields."""
    info: Dict[str, Any] = {}
    lower = phrase.lower()

    for hint, (key, val) in BOOLEAN_HINTS.items():
        if hint in lower:
            info[key] = val

    m = re.search(r"(\d+)\s+(?:employees|staff|workers)", lower)
    if m:
        info["employees"] = int(m.group(1))

    m = re.search(r"(?:founded|since|around)\s+(\d{4})", lower)
    if m:
        year = int(m.group(1))
        info["business_age_years"] = datetime.utcnow().year - year

    if "biotech" in lower or "bio tech" in lower:
        info["industry"] = "biotech"

    if ("not veteran" in lower or "non-veteran" in lower) and "veteran" in lower:
        info["owner_veteran"] = False

    return info

def infer_field_from_text(text: str) -> Dict[str, Any]:
    """Infer structured fields from a blob of text."""
    result: Dict[str, Any] = {}
    for part in re.split(r"[\.\n]", text):
        part = part.strip()
        if not part:
            continue
        result.update(parse_user_phrase(part))
    return result


def llm_semantic_inference(text: str, known: Dict[str, Any]) -> Dict[str, Any]:
    """Placeholder for GPT-style inference of missing fields."""
    inferred = infer_field_from_text(text)
    # merge but don't overwrite existing known values
    for k, v in inferred.items():
        if k not in known:
            known[k] = v
    return known
