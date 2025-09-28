"""Utilities to map businesses to NAICS industries."""

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence

CATALOG_PATH = Path(__file__).resolve().parent / "industries.json"


def _normalize_code(raw: Any) -> Optional[str]:
    if raw is None:
        return None
    if isinstance(raw, (int, float)):
        raw = str(int(raw))
    code = str(raw).strip()
    if not code:
        return None
    digits = re.sub(r"[^0-9]", "", code)
    if not digits:
        return None
    if len(digits) >= 3:
        digits = digits[:3]
    return digits


def _coerce_entry(value: Any, *, default_source: str) -> Optional[Dict[str, Any]]:
    if isinstance(value, dict):
        code = _normalize_code(value.get("code") or value.get("naics_code"))
        if not code:
            return None
        confidence = value.get("confidence")
        if confidence is None:
            confidence = 1.0
        source = value.get("source") or default_source
        entry = {**value, "code": code, "confidence": float(confidence), "source": source}
        return entry
    code = _normalize_code(value)
    if not code:
        return None
    return {"code": code, "confidence": 1.0, "source": default_source}


@lru_cache()
def load_catalog() -> List[Dict[str, Any]]:
    with CATALOG_PATH.open("r", encoding="utf-8") as fh:
        data = json.load(fh)
        return data


@lru_cache()
def catalog_by_code() -> Dict[str, Dict[str, Any]]:
    return {item["naics_code"]: item for item in load_catalog()}


def _iter_naics_values(value: Any, *, default_source: str) -> Iterable[Dict[str, Any]]:
    if isinstance(value, list):
        for item in value:
            entry = _coerce_entry(item, default_source=default_source)
            if entry:
                yield entry
    else:
        entry = _coerce_entry(value, default_source=default_source)
        if entry:
            yield entry


def _collect_textual_evidence(data: Dict[str, Any]) -> List[str]:
    fields: Sequence[str] = (
        "industry",
        "business_description",
        "business_activity",
        "executive_summary",
        "service_description",
        "project_description",
        "business_name",
        "company_name",
    )
    snippets: List[str] = []
    for field in fields:
        value = data.get(field)
        if not value:
            continue
        if isinstance(value, str):
            snippets.append(value)
        elif isinstance(value, dict):
            snippets.extend(str(v) for v in value.values() if isinstance(v, str))
        elif isinstance(value, list):
            snippets.extend(str(item) for item in value if isinstance(item, str))
    tags = data.get("tags")
    if isinstance(tags, list):
        snippets.extend(str(tag) for tag in tags if isinstance(tag, str))
    return snippets


def _find_direct_code(text: str) -> Optional[str]:
    for match in re.findall(r"naics\s*(\d{3,6})", text):
        code = _normalize_code(match)
        if code and code in catalog_by_code():
            return code
    return None


def _contains(text: str, phrase: str) -> bool:
    if not phrase:
        return False
    pattern = rf"(?<!\w){re.escape(phrase)}(?!\w)"
    return re.search(pattern, text) is not None


def _score_industry(entry: Dict[str, Any], *, text: str, keywords: Sequence[str]):
    lowered_keywords = {k.lower() for k in keywords}
    alias_matches: List[str] = []
    alias_bonus = 0
    for alias in entry.get("aliases", []):
        alias_l = alias.lower()
        if alias_l in lowered_keywords or alias_l in text:
            alias_matches.append(alias)
            alias_bonus += 5
    name = entry.get("name", "").lower()
    name_match = name in text
    description = entry.get("description", "").lower()
    desc_terms = [term.strip() for term in re.split(r"[,/]| and ", description) if term.strip()]
    desc_bonus = sum(1 for term in desc_terms if term and term in text)
    score = alias_bonus
    if name_match:
        score += 3
    score += desc_bonus
    return score, alias_matches, name_match, desc_bonus


def _infer_from_text(data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    snippets = _collect_textual_evidence(data)
    if not snippets:
        return None
    text = " ".join(snippet.lower() for snippet in snippets if isinstance(snippet, str))
    if not text.strip():
        return None
    direct = _find_direct_code(text)
    if direct:
        return {
            "code": direct,
            "confidence": 0.95,
            "source": "text_naics",
            "matched_aliases": [f"naics {direct}"],
        }
    best: Optional[Dict[str, Any]] = None
    best_score = 0
    best_aliases: List[str] = []
    keywords = [snippet.lower() for snippet in snippets if isinstance(snippet, str)]
    for entry in load_catalog():
        score, aliases, name_match, desc_bonus = _score_industry(entry, text=text, keywords=keywords)
        if score <= 0:
            continue
        if score > best_score:
            best_score = score
            best_aliases = aliases
            confidence = 0.4 + 0.1 * len(aliases) + (0.1 if name_match else 0.0) + min(0.1, 0.05 * desc_bonus)
            best = {
                "code": entry["naics_code"],
                "confidence": round(min(confidence, 0.95), 2),
                "source": "inferred",
                "matched_aliases": sorted(set(aliases)),
            }
    return best


def assign_industry_naics(data: Dict[str, Any]) -> Dict[str, Any]:
    """Augment a normalized payload with an inferred NAICS code."""
    enriched = dict(data)
    existing = enriched.get("business_industry_naics")
    normalized_existing = _coerce_entry(existing, default_source="provided") if existing else None
    if not normalized_existing:
        for entry in _iter_naics_values(enriched.get("company_naics"), default_source="company_naics"):
            normalized_existing = entry
            break
    if not normalized_existing:
        normalized_existing = _infer_from_text(enriched)
    if normalized_existing:
        enriched["business_industry_naics"] = normalized_existing
    return enriched


def list_naics_codes(data: Dict[str, Any]) -> List[str]:
    """Return all known NAICS codes for a business, normalized to 3 digits."""
    codes: List[str] = []
    entry = data.get("business_industry_naics")
    normalized_entry = _coerce_entry(entry, default_source="provided") if entry else None
    if normalized_entry:
        codes.append(normalized_entry["code"])
    for extra in _iter_naics_values(data.get("company_naics"), default_source="company_naics"):
        code = extra["code"]
        if code not in codes:
            codes.append(code)
    return codes


__all__ = ["assign_industry_naics", "list_naics_codes", "load_catalog"]
