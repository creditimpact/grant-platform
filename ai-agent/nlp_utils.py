import os
import re
from datetime import datetime
from typing import Dict, Tuple, Any, List

try:
    from dotenv import load_dotenv
except Exception:  # pragma: no cover - package may be missing
    def load_dotenv(*args, **kwargs):
        return False

try:
    import openai  # type: ignore
except Exception:  # pragma: no cover - openai optional for tests
    openai = None  # type: ignore

load_dotenv()
try:
    from .config import settings  # type: ignore
except ImportError:  # pragma: no cover - script execution
    from config import settings  # type: ignore
OPENAI_API_KEY = getattr(settings, "OPENAI_API_KEY", None)
if openai and OPENAI_API_KEY:
    openai.api_key = OPENAI_API_KEY


def llm_complete(
    prompt: str,
    system: str | None = "You are a helpful grants advisor.",
    history: List[Dict[str, str]] | None = None,
) -> str:
    """Return a completion from OpenAI, with graceful fallback."""
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    if history:
        messages.extend(history)
    messages.append({"role": "user", "content": prompt})

    if openai and openai.api_key:
        try:  # pragma: no cover - network call
            resp = openai.ChatCompletion.create(model="gpt-3.5-turbo", messages=messages)
            return resp.choices[0].message.content.strip()
        except Exception:
            pass

    # simple fallback if API unavailable
    return prompt[:200]

# State lookup for basic zip inference
ZIP_PREFIX_STATE = {
    "9": "CA",
    "1": "NY",
    "6": "IL",
}

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
    "postal_code": "zip",
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


def infer_state_from_zip(zip_code: str | int | None) -> str | None:
    """Return US state abbreviation from a zip prefix."""
    if not zip_code:
        return None
    zip_str = str(zip_code)
    for prefix, state in ZIP_PREFIX_STATE.items():
        if zip_str.startswith(prefix):
            return state
    return None


def guess_default(field_name: str) -> Any:
    """Return a naive default value for unknown fields."""
    canonical = resolve_field_name(field_name)
    defaults = {
        "employees": 1,
        "state": "CA",
        "city": "San Francisco",
        "industry": "general",
    }
    return defaults.get(canonical, "")

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
    canonical = resolve_field_name(field_name)
    value = raw_value
    if isinstance(raw_value, str):
        lowered = raw_value.strip().lower()
        # boolean type heuristics
        if lowered in {"yes", "true", "1", "y"} or ("yes" in lowered and "no" not in lowered):
            value = True
        elif lowered in {"no", "false", "0", "n"} or ("no" in lowered and "yes" not in lowered):
            value = False
        elif lowered in {"maybe", "unknown", "not sure", "unsure"}:
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

    m = re.search(r"\b(\d{5})\b", lower)
    if m:
        info["zip"] = m.group(1)
        state = infer_state_from_zip(m.group(1))
        if state:
            info.setdefault("state", state)

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
    for k, v in inferred.items():
        if k not in known:
            known[k] = v

    # additional smart inference
    if "annual_income" not in known and known.get("annual_revenue"):
        known["annual_income"] = known["annual_revenue"]

    if "state" not in known and known.get("zip"):
        state = infer_state_from_zip(known.get("zip"))
        if state:
            known["state"] = state

    # naive fallback defaults
    for field in ["state", "industry", "employees"]:
        if field not in known or known[field] in {"", None}:
            known[field] = guess_default(field)

    return known
