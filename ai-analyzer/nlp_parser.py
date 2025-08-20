import re
from datetime import datetime
from typing import Any, Dict, Tuple, List, Optional


def normalize_text(text: str) -> str:
    """Return text with collapsed whitespace and printable characters only."""
    if not text:
        return ""
    text = "".join(ch for ch in text if ch.isprintable())
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def parse_money(value: str) -> int:
    """Parse a human friendly currency string into whole dollars."""
    value = value.strip().lower().replace("$", "").replace(",", "")
    multiplier = 1
    if value.endswith("m"):
        multiplier = 1_000_000
        value = value[:-1]
    elif value.endswith("k"):
        multiplier = 1_000
        value = value[:-1]
    try:
        return int(float(value) * multiplier)
    except ValueError:
        match = re.search(r"\d+", value)
        return int(match.group()) if match else 0


_STATE_MAP = {
    "alabama": "AL",
    "alaska": "AK",
    "arizona": "AZ",
    "arkansas": "AR",
    "california": "CA",
    "colorado": "CO",
    "connecticut": "CT",
    "delaware": "DE",
    "florida": "FL",
    "georgia": "GA",
    "hawaii": "HI",
    "idaho": "ID",
    "illinois": "IL",
    "indiana": "IN",
    "iowa": "IA",
    "kansas": "KS",
    "kentucky": "KY",
    "louisiana": "LA",
    "maine": "ME",
    "maryland": "MD",
    "massachusetts": "MA",
    "michigan": "MI",
    "minnesota": "MN",
    "mississippi": "MS",
    "missouri": "MO",
    "montana": "MT",
    "nebraska": "NE",
    "nevada": "NV",
    "new hampshire": "NH",
    "new jersey": "NJ",
    "new mexico": "NM",
    "new york": "NY",
    "north carolina": "NC",
    "north dakota": "ND",
    "ohio": "OH",
    "oklahoma": "OK",
    "oregon": "OR",
    "pennsylvania": "PA",
    "rhode island": "RI",
    "south carolina": "SC",
    "south dakota": "SD",
    "tennessee": "TN",
    "texas": "TX",
    "utah": "UT",
    "vermont": "VT",
    "virginia": "VA",
    "washington": "WA",
    "west virginia": "WV",
    "wisconsin": "WI",
    "wyoming": "WY",
}


def normalize_state(value: str) -> Optional[str]:
    val = value.strip().lower()
    if len(val) == 2 and val.upper() in _STATE_MAP.values():
        return val.upper()
    return _STATE_MAP.get(val)


def normalize_country(value: str) -> Optional[str]:
    val = value.strip().lower()
    if val in {"us", "usa", "united states", "united states of america"}:
        return "US"
    return None


_EIN_RE = re.compile(r"\b(?:EIN[:\s]*)?(\d{2}[- ]?\d{7})\b", re.I)
_W2_RE = re.compile(r"\bW-?2(?:\s+employees?\b|\s+count\b|\b)\D{0,10}(\d{1,5})", re.I)
_QUARTER_PATTERNS = [
    re.compile(r"(Q[1-4]|Quarter\s*[1-4])\D{0,10}(20\d{2})\D{0,20}([\$0-9,\.]+[kKmM]?)", re.I),
    re.compile(r"(20\d{2})\D{0,10}(Q[1-4]|Quarter\s*[1-4])\D{0,20}([\$0-9,\.]+[kKmM]?)", re.I),
]

_ENTITY_MAP = {
    r"llc": "llc",
    r"c[-\s]?corp|c corporation": "corp_c",
    r"s[-\s]?corp|s corporation": "corp_s",
    r"partnership|llp|lp": "partnership",
    r"sole prop|sole proprietorship": "sole_prop",
    r"non[-\s]?profit|not[-\s]?for[-\s]?profit|501\(c\)": "nonprofit",
    r"coop|co-?op|cooperative": "cooperative",
}


def extract_ein(text: str) -> Tuple[Optional[str], float, List[str], List[Dict[str, Any]]]:
    candidates = [m.group(1) for m in _EIN_RE.finditer(text)]
    normalized_candidates = [c.replace(" ", "-").replace("-", "", 1) for c in candidates]
    normalized_candidates = [f"{c[:2]}-{c[2:]}" for c in normalized_candidates]
    value = normalized_candidates[0] if normalized_candidates else None
    conf = 0.0
    ambiguities: List[Dict[str, Any]] = []
    if value:
        conf = 0.8
        for m in _EIN_RE.finditer(text):
            if m.group(1).replace(" ", "-") == value:
                before = text[max(0, m.start() - 10):m.start()].lower()
                if "ein" in before or "employer identification" in before:
                    conf += 0.1
                break
        if len(set(normalized_candidates)) > 1:
            ambiguities.append({
                "field": "ein",
                "candidates": list(dict.fromkeys(normalized_candidates)),
                "reason": "multiple EIN-like strings found",
            })
        conf = min(conf, 1.0)
    return value, conf, normalized_candidates, ambiguities


def extract_w2_count(text: str) -> Tuple[Optional[int], float]:
    match = _W2_RE.search(text)
    if not match:
        return None, 0.0
    count = int(match.group(1))
    return count, 0.8


def extract_quarterly_revenues(text: str) -> Tuple[Dict[str, Dict[str, int]], Dict[str, float]]:
    revenues: Dict[str, Dict[str, int]] = {}
    conf: Dict[str, float] = {}
    for pattern in _QUARTER_PATTERNS:
        for m in pattern.finditer(text):
            g1, g2, amt = m.groups()
            if pattern is _QUARTER_PATTERNS[0]:
                quarter_raw, year_raw = g1, g2
            else:
                year_raw, quarter_raw = g1, g2
            quarter = "Q" + re.sub(r"[^1-4]", "", quarter_raw)
            year = year_raw
            amount = parse_money(amt)
            revenues.setdefault(year, {})[quarter] = amount
            conf[f"quarterly_revenues.{year}.{quarter}"] = 0.9
    return revenues, conf


def extract_entity_type(text: str) -> Tuple[Optional[str], float]:
    for pattern, normalized in _ENTITY_MAP.items():
        if re.search(pattern, text, re.I):
            return normalized, 0.85
    return None, 0.0


def extract_year_founded(text: str) -> Tuple[Optional[int], float]:
    m = re.search(r"(?i)(?:founded|incorporated|since)\D{0,10}(\d{4})", text)
    if not m:
        return None, 0.0
    year = int(m.group(1))
    current = datetime.now().year
    if 1800 <= year <= current:
        return year, 0.8
    return None, 0.0


def extract_annual_revenue(text: str) -> Tuple[Optional[int], float]:
    m = re.search(r"(?i)(?:annual revenue|total revenue)\D{0,20}([\$0-9,\.]+[kKmM]?)", text)
    if not m:
        return None, 0.0
    return parse_money(m.group(1)), 0.8


def extract_location(text: str) -> Tuple[Optional[str], float, Optional[str], float]:
    state_conf = 0.0
    country_conf = 0.0
    state = None
    country = None
    for name, abbr in _STATE_MAP.items():
        if re.search(rf"\b{name}\b", text, re.I) or re.search(rf"\b{abbr}\b", text, re.I):
            state = abbr
            state_conf = 0.8
            break
    if re.search(r"\b(?:united states|usa|us)\b", text, re.I):
        country = "US"
        country_conf = 0.8
    return state, state_conf, country, country_conf


def extract_ownership(text: str) -> Tuple[Dict[str, Optional[bool]], Dict[str, float]]:
    fields: Dict[str, Optional[bool]] = {
        "minority_owned": None,
        "female_owned": None,
        "veteran_owned": None,
    }
    conf: Dict[str, float] = {}
    if re.search(r"minority[-\s]owned", text, re.I):
        fields["minority_owned"] = True
        conf["minority_owned"] = 0.9
    if re.search(r"(female|women|woman)[-\s]owned", text, re.I):
        fields["female_owned"] = True
        conf["female_owned"] = 0.9
    if re.search(r"veteran[-\s]owned", text, re.I):
        fields["veteran_owned"] = True
        conf["veteran_owned"] = 0.9
    return fields, conf


def extract_credit_refs(text: str) -> Tuple[Optional[bool], float, Optional[bool], float]:
    ppp = None
    ppp_conf = 0.0
    ertc = None
    ertc_conf = 0.0
    if re.search(r"\bPPP\b|paycheck protection program", text, re.I):
        ppp = True
        ppp_conf = 0.9
    if re.search(r"\bERTC\b|employee retention tax credit", text, re.I):
        ertc = True
        ertc_conf = 0.9
    return ppp, ppp_conf, ertc, ertc_conf


def extract_fields(text: str, *, enable_secondary: bool = True) -> Tuple[Dict[str, Any], Dict[str, float], List[Dict[str, Any]]]:
    fields: Dict[str, Any] = {}
    confidence: Dict[str, float] = {}
    ambiguities: List[Dict[str, Any]] = []

    ein, ein_conf, _, ein_amb = extract_ein(text)
    if ein:
        fields["ein"] = ein
        confidence["ein"] = ein_conf
    ambiguities.extend(ein_amb)

    w2, w2_conf = extract_w2_count(text)
    if w2 is not None:
        fields["w2_employee_count"] = w2
        confidence["w2_employee_count"] = w2_conf

    revs, rev_conf = extract_quarterly_revenues(text)
    if revs:
        fields["quarterly_revenues"] = revs
        confidence.update(rev_conf)

    entity, entity_conf = extract_entity_type(text)
    if entity:
        fields["entity_type"] = entity
        confidence["entity_type"] = entity_conf

    if enable_secondary:
        year, year_conf = extract_year_founded(text)
        if year:
            fields["year_founded"] = year
            confidence["year_founded"] = year_conf

        annual, annual_conf = extract_annual_revenue(text)
        if annual:
            fields["annual_revenue"] = annual
            confidence["annual_revenue"] = annual_conf

        state, state_conf, country, country_conf = extract_location(text)
        if state:
            fields["location_state"] = state
            confidence["location_state"] = state_conf
        if country:
            fields["location_country"] = country
            confidence["location_country"] = country_conf

        ownership, own_conf = extract_ownership(text)
        for k, v in ownership.items():
            if v is not None:
                fields[k] = v
        confidence.update(own_conf)

        ppp, ppp_conf, ertc, ertc_conf = extract_credit_refs(text)
        if ppp is not None:
            fields["ppp_reference"] = ppp
            confidence["ppp_reference"] = ppp_conf
        if ertc is not None:
            fields["ertc_reference"] = ertc
            confidence["ertc_reference"] = ertc_conf

    return fields, confidence, ambiguities


# Backwards compatibility
parse_fields = extract_fields
