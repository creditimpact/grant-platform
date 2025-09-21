from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional, Tuple

FREQUENCY_MAP = {
    "A": "always",
    "F": "frequently",
    "S": "seldom",
    "N": "never",
}

SECTION_PATTERNS = [
    "uniform certification application",
    "disadvantaged business enterprise (dbe)",
    "airport concession disadvantaged business enterprise",
    "49 c.f.r. parts 23",
    "section 1: certification information",
    "section 2: general information",
    "section 3",
    "section 4",
    "affidavit of certification",
]

DATE_FORMATS = [
    "%m/%d/%Y",
    "%m-%d-%Y",
    "%Y-%m-%d",
    "%m/%d/%y",
    "%m-%d-%y",
    "%B %d, %Y",
    "%b %d, %Y",
]

SSN_RE = re.compile(r"(?<!\d)(\d{3})[-\s]?(\d{2})[-\s]?(\d{4})(?!\d)")
EIN_RE = re.compile(r"(?<!\d)(\d{2})[-\s]?(\d{7})(?!\d)")
MONEY_CANDIDATE_RE = re.compile(r"\(?[-$]?\d[\d,]*(?:\.\d+)?\)?")
PERCENT_RE = re.compile(r"(-?\d+[\d,.]*)(%)?")
STATE_RE = re.compile(r"\b([A-Z]{2})\b")


@dataclass
class ParsedOwner:
    raw_block: str
    index: int


def detect(text: str) -> bool:
    if not text:
        return False
    lowered = text.lower()
    hits = 0
    for needle in SECTION_PATTERNS:
        if needle in lowered:
            hits += 1
    if "dbe" in lowered and "uniform" in lowered and "application" in lowered:
        hits += 1
    if "airport concession" in lowered:
        hits += 1
    return hits >= 3


def _normalize_phone(value: str) -> Optional[str]:
    digits = re.sub(r"\D", "", value)
    if not digits:
        return None
    if len(digits) == 10:
        return f"{digits[:3]}-{digits[3:6]}-{digits[6:]}"
    if len(digits) == 11 and digits.startswith("1"):
        return f"{digits[1:4]}-{digits[4:7]}-{digits[7:]}"
    if len(digits) == 7:
        return f"{digits[:3]}-{digits[3:]}"
    return digits


def _normalize_date(value: str) -> Optional[str]:
    clean = value.strip().replace("\u2013", "-")
    clean = re.sub(r"(?:on|dated)\s+", "", clean, flags=re.IGNORECASE)
    clean = clean.replace("st", "").replace("nd", "").replace("rd", "").replace("th", "")
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(clean, fmt).date().isoformat()
        except Exception:
            continue
    parts = re.findall(r"\d{1,2}/\d{1,2}/\d{2,4}", clean)
    if parts:
        for fmt in DATE_FORMATS:
            try:
                return datetime.strptime(parts[0], fmt).date().isoformat()
            except Exception:
                continue
    return None


def _parse_money(value: str) -> Optional[float]:
    matches = MONEY_CANDIDATE_RE.findall(value)
    for match in matches:
        digits_only = re.sub(r"[^0-9]", "", match)
        if len(digits_only) < 3 and "$" not in match and "," not in match:
            continue
        cleaned = match.replace("$", "").replace(",", "")
        if cleaned.startswith("(") and cleaned.endswith(")"):
            cleaned = f"-{cleaned[1:-1]}"
        cleaned = cleaned.replace("(", "-").replace(")", "")
        cleaned = cleaned.replace("--", "-")
        try:
            return float(cleaned)
        except ValueError:
            continue
    return None


def _parse_percent(value: str) -> Optional[float]:
    m = PERCENT_RE.search(value)
    if not m:
        return None
    raw = m.group(1).replace(",", "")
    try:
        pct = float(raw)
        if pct <= 1 and not m.group(2):
            pct *= 100
        return pct
    except ValueError:
        return None


def _extract_line(lines: Iterable[str], prefix: str) -> Optional[str]:
    prefix_lower = prefix.lower()
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.lower().startswith(prefix_lower):
            after = stripped[len(prefix) :].strip()
            if after.startswith(":"):
                after = after[1:].strip()
            return after
    return None


def _parse_site_visits(raw: Optional[str]) -> List[Dict[str, Any]]:
    if not raw:
        return []
    visits: List[Dict[str, Any]] = []
    for part in re.split(r"[;,]", raw):
        chunk = part.strip()
        if not chunk:
            continue
        state = None
        date_iso = None
        tokens = chunk.split()
        if tokens:
            potential_state = tokens[0].upper()
            if STATE_RE.fullmatch(potential_state):
                state = potential_state
                date_iso = _normalize_date(" ".join(tokens[1:])) if len(tokens) > 1 else None
            else:
                date_iso = _normalize_date(chunk)
        visits.append({"state": state, "date": date_iso})
    return visits


def _parse_address(raw: Optional[str]) -> Dict[str, Optional[str]]:
    if not raw:
        return {"raw": None, "street": None, "city": None, "state": None, "postal_code": None}
    raw_clean = " ".join(raw.split())
    city = state = postal = None
    m = re.search(r",\s*([^,]+),\s*([A-Z]{2})\s*(\d{5})(?:-\d{4})?", raw_clean)
    street = raw_clean
    if m:
        street = raw_clean[: m.start()].strip(", ")
        city = m.group(1).strip()
        state = m.group(2).strip()
        postal = m.group(3).strip()
    return {
        "raw": raw_clean,
        "street": street or None,
        "city": city,
        "state": state,
        "postal_code": postal,
    }


def _categorize_acquisition(value: Optional[str]) -> Dict[str, Optional[str]]:
    if not value:
        return {"type": None, "description": None}
    lowered = value.lower()
    acq_type = "other"
    if any(word in lowered for word in ["new", "start", "startup"]):
        acq_type = "new"
    elif "bought" in lowered or "purchase" in lowered or "purchased" in lowered:
        acq_type = "bought"
    elif "inherit" in lowered:
        acq_type = "inherited"
    elif "merger" in lowered or "joint" in lowered:
        acq_type = "merger"
    elif "concession" in lowered:
        acq_type = "secured_concession"
    return {"type": acq_type, "description": value.strip()}


def _split_entries(raw: Optional[str]) -> List[str]:
    if not raw:
        return []
    entries = [chunk.strip() for chunk in re.split(r";|\n|,\s-", raw) if chunk.strip()]
    return entries


def _parse_owner_blocks(section: str) -> List[ParsedOwner]:
    owners: List[ParsedOwner] = []
    pattern = re.compile(r"Owner Name:\s*(.+?)(?=(?:Owner Name:|Section\s+4:|ACDBE|Affidavit|$))", re.IGNORECASE | re.DOTALL)
    for idx, match in enumerate(pattern.finditer(section)):
        owners.append(ParsedOwner(raw_block=match.group(0), index=idx))
    return owners


def _parse_owner(block: str) -> Dict[str, Any]:
    lines = [line.strip() for line in block.splitlines() if line.strip()]
    owner: Dict[str, Any] = {}
    raw_name = _extract_line(lines, "Owner Name")
    if raw_name:
        owner["fullName"] = raw_name.strip()
    title = _extract_line(lines, "Title")
    if title:
        owner["title"] = title
    home_phone = _extract_line(lines, "Home Phone")
    if home_phone:
        owner["homePhone"] = _normalize_phone(home_phone)
    home_addr = _extract_line(lines, "Home Address")
    if home_addr:
        owner["homeAddress"] = home_addr.strip()
    gender_line = next((l for l in lines if l.lower().startswith("gender")), None)
    if gender_line:
        gender_match = re.search(r"Gender:\s*([^\s]+)", gender_line, re.IGNORECASE)
        if gender_match:
            owner["gender"] = gender_match.group(1).strip().lower()
        eth_match = re.search(r"Ethnicity:\s*(.+)", gender_line, re.IGNORECASE)
        if eth_match:
            ethnicities = [part.strip() for part in re.split(r"[;,]", eth_match.group(1)) if part.strip()]
            owner["ethnicity"] = ethnicities
    citizen_line = _extract_line(lines, "Citizenship")
    if citizen_line:
        lowered = citizen_line.lower()
        if "permanent" in lowered or "resident" in lowered:
            owner["citizenship"] = "lpr"
        else:
            owner["citizenship"] = "citizen"
    years = _extract_line(lines, "Years as Owner")
    if years:
        try:
            owner["yearsAsOwner"] = int(re.sub(r"[^0-9]", "", years))
        except Exception:
            pass
    pct = _extract_line(lines, "Ownership Percentage")
    if pct:
        val = _parse_percent(pct)
        owner["ownershipPct"] = val
    stock = _extract_line(lines, "Stock Class")
    if stock:
        owner["stockClass"] = stock
    date_acq = _extract_line(lines, "Date Acquired")
    if date_acq:
        owner["dateAcquired"] = _normalize_date(date_acq)
    initial: Dict[str, Any] = {}
    for label, key in [
        ("Initial Investment - Cash", "cash"),
        ("Initial Investment - Real Estate", "realEstate"),
        ("Initial Investment - Equipment", "equipment"),
        ("Initial Investment - Other", "other"),
    ]:
        raw_val = _extract_line(lines, label)
        if raw_val is not None:
            parsed = _parse_money(raw_val)
            initial[key] = parsed if parsed is not None else raw_val.strip()
    if initial:
        owner["initialInvestment"] = initial
    acquisition = _extract_line(lines, "Acquisition Narrative")
    if acquisition:
        owner["acquisitionNarrative"] = acquisition
    affiliations = _extract_line(lines, "Other Affiliations")
    if affiliations:
        over10 = None
        m = re.search(r">\s*10\s*hours/\s*week\s*:\s*(Yes|No)", affiliations, re.IGNORECASE)
        if m:
            over10 = m.group(1).strip().lower() == "yes"
        owner["otherAffiliations"] = [
            {"description": affiliations.split("(")[0].strip(), "overTenHoursPerWeek": over10}
        ]
    trust = _extract_line(lines, "Trust Exists")
    if trust:
        owner["trustExists"] = trust.strip().lower().startswith("y")
    pnw = _extract_line(lines, "Personal Net Worth Statement Provided")
    if pnw:
        owner["personalNetWorth"] = {"present": pnw.strip().lower().startswith("y")}
    family = _extract_line(lines, "Family Ties")
    if family:
        ties: List[Dict[str, str]] = []
        for item in re.split(r";", family):
            piece = item.strip()
            if not piece:
                continue
            m = re.match(r"(.+?)\s*\((.+)\)", piece)
            if m:
                ties.append({"name": m.group(1).strip(), "relationship": m.group(2).strip()})
            else:
                ties.append({"name": piece, "relationship": None})
        if ties:
            owner["familyTies"] = ties
    return owner


def _parse_lines(text: str) -> List[str]:
    return [line.rstrip("\n") for line in text.splitlines()]


def _extract_control_lists(section: str, heading: str) -> List[Dict[str, Any]]:
    pattern = re.compile(rf"{heading}:\s*(.+?)(?=\n\w|$)", re.IGNORECASE | re.DOTALL)
    matches = pattern.findall(section)
    entries: List[Dict[str, Any]] = []
    for match in matches:
        for line in match.splitlines():
            line = line.strip("- \t")
            if not line:
                continue
            parts = [part.strip() for part in line.split(",")]
            if not parts:
                continue
            name = parts[0]
            data: Dict[str, Any] = {"name": name}
            for piece in parts[1:]:
                piece = piece.strip()
                if piece.lower().startswith("appointed"):
                    date = piece.split("appointed", 1)[-1].strip()
                    data["dateAppointed"] = _normalize_date(date)
                elif piece.lower().startswith("ethnicity"):
                    data["ethnicity"] = [piece.split("ethnicity", 1)[-1].strip()]
                elif piece.lower().startswith("gender"):
                    data["gender"] = piece.split("gender", 1)[-1].strip().lower()
                else:
                    if "title" not in data:
                        data["title"] = piece
            if "title" not in data and len(parts) > 1:
                data["title"] = parts[1]
            entries.append(data)
    return entries


def _parse_duties(section: str) -> Dict[str, Dict[str, Any]]:
    duties: Dict[str, Dict[str, Any]] = {}
    for line in section.splitlines():
        if ":" not in line:
            continue
        label, value = line.split(":", 1)
        code = value.strip().upper()[:1]
        if code not in FREQUENCY_MAP:
            continue
        key = re.sub(r"[^a-z]", " ", label.lower()).strip()
        key = key.replace(" ", "_")
        duties[key] = {
            "code": code,
            "frequency": FREQUENCY_MAP[code],
            "active": code != "N",
        }
    return duties


def _parse_equipment(section: str) -> Dict[str, List[Dict[str, Any]]]:
    data = {"equipment": [], "offices": [], "storage": []}
    for line in section.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.lower().startswith("equipment:"):
            raw = stripped.split(":", 1)[1].strip()
            entry: Dict[str, Any] = {"description": raw}
            entry["value"] = _parse_money(raw)
            if "owned" in raw.lower():
                entry["ownedBy"] = "firm" if "firm" in raw.lower() else raw
            if "leased" in raw.lower():
                entry["ownedBy"] = "leased"
            data["equipment"].append(entry)
        elif stripped.lower().startswith("offices:"):
            raw = stripped.split(":", 1)[1].strip()
            entry = _parse_address(raw)
            entry["raw"] = raw
            entry["ownedBy"] = "leased" if "lease" in raw.lower() else "owned"
            entry["valueOrLease"] = _parse_money(raw)
            data["offices"].append(entry)
        elif stripped.lower().startswith("storage:"):
            raw = stripped.split(":", 1)[1].strip()
            entry = _parse_address(raw)
            entry["raw"] = raw
            entry["ownedBy"] = "leased" if "lease" in raw.lower() else "owned"
            entry["valueOrLease"] = _parse_money(raw)
            data["storage"].append(entry)
    return data


def _parse_finance(section: str) -> Dict[str, Any]:
    finance: Dict[str, Any] = {
        "reliesOnPEOOrCoMgmt": None,
        "bankAccounts": [],
        "bonding": {},
        "loans": [],
        "assetTransfers": [],
    }
    for line in section.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        lowered = stripped.lower()
        if "professional employer" in lowered or "co-management" in lowered:
            finance["reliesOnPEOOrCoMgmt"] = "yes" in lowered
        elif lowered.startswith("bank accounts:"):
            after = stripped.split(":", 1)[1].strip()
            m = re.match(r"(.+?)-\s*([^()]+)(?:\s*\((.+)\))?", after)
            account = {"bank": after}
            if m:
                account = {
                    "bank": m.group(1).strip(),
                    "location": m.group(2).strip(),
                    "authorizedSigners": [
                        signer.strip()
                        for signer in re.split(r"[,;]", m.group(3) or "")
                        if signer.strip()
                    ],
                }
            finance["bankAccounts"].append(account)
        elif lowered.startswith("bonding:"):
            after = stripped.split(":", 1)[1].strip()
            agg = re.search(r"Aggregate Limit\s*\$?([\d,\.]+)", after)
            proj = re.search(r"Project Limit\s*\$?([\d,\.]+)", after)
            if agg:
                finance["bonding"]["aggregateLimit"] = _parse_money(agg.group(0))
            if proj:
                finance["bonding"]["projectLimit"] = _parse_money(proj.group(0))
        elif lowered.startswith("loans:"):
            after = stripped.split(":", 1)[1].strip()
            loan = {
                "raw": after,
                "source": after.split(";")[0].strip(),
                "originalAmount": _parse_money(after),
                "currentBalance": _parse_money(after.split("Current Balance", 1)[-1])
                if "Current Balance" in after
                else None,
            }
            guarantor = re.search(r"Guarantor:\s*([^;]+)", after)
            if guarantor:
                loan["guarantor"] = guarantor.group(1).strip()
            purpose = re.search(r"Purpose:\s*([^;]+)", after)
            if purpose:
                loan["purpose"] = purpose.group(1).strip()
            finance["loans"].append(loan)
        elif lowered.startswith("asset transfers:"):
            after = stripped.split(":", 1)[1].strip()
            transfer = {"raw": after}
            value = _parse_money(after)
            if value is not None:
                transfer["value"] = value
            rel = re.search(r"Relationship:\s*([^,]+)", after)
            if rel:
                transfer["relationship"] = rel.group(1).strip()
            date = re.search(r"Date:\s*([0-9/\-]+)", after)
            if date:
                transfer["date"] = _normalize_date(date.group(1))
            finance["assetTransfers"].append(transfer)
    return finance


def _parse_list_section(section: str, header: str) -> List[str]:
    pattern = re.compile(rf"{header}:\s*(.+?)(?=\n\w|$)", re.IGNORECASE | re.DOTALL)
    matches = pattern.findall(section)
    entries: List[str] = []
    for match in matches:
        for line in match.splitlines():
            stripped = line.strip("- \t")
            if stripped:
                entries.append(stripped)
    return entries


def _parse_money_pairs(lines: Iterable[str]) -> List[Dict[str, Any]]:
    receipts: List[Dict[str, Any]] = []
    pattern = re.compile(
        r"Gross Receipts\s+(\d{4})\s+Applicant\s+([$0-9,\.]+)(?:\s+Affiliates\s+([$0-9,\.]+))?",
        re.IGNORECASE,
    )
    for line in lines:
        m = pattern.search(line)
        if m:
            year = int(m.group(1))
            applicant = _parse_money(m.group(2))
            affiliates = _parse_money(m.group(3) or "0") if m.group(3) else None
            receipts.append(
                {
                    "year": year,
                    "applicant": applicant,
                    "affiliates": affiliates,
                }
            )
    return receipts


def _parse_employee_counts(line: Optional[str]) -> Dict[str, Optional[int]]:
    counts = {"fullTime": None, "partTime": None, "seasonal": None, "total": None}
    if not line:
        return counts
    for key, field in [
        ("Full-time", "fullTime"),
        ("Part-time", "partTime"),
        ("Seasonal", "seasonal"),
        ("Total", "total"),
    ]:
        m = re.search(rf"{key}[^0-9]*(\d+)", line, re.IGNORECASE)
        if m:
            counts[field] = int(m.group(1))
    return counts


def _assign(target: Dict[str, Any], path: Iterable[str], value: Any) -> None:
    cur = target
    path = list(path)
    for key in path[:-1]:
        cur = cur.setdefault(key, {})
    cur[path[-1]] = value


def _mask_value(value: Any) -> Any:
    if isinstance(value, str):
        value = SSN_RE.sub(lambda m: f"###-##-{m.group(3)}", value)
        value = EIN_RE.sub(lambda m: f"##-###{m.group(2)[-4:]}", value)
        return value
    if isinstance(value, list):
        return [_mask_value(v) for v in value]
    if isinstance(value, dict):
        return {k: _mask_value(v) for k, v in value.items()}
    return value


def extract(text: str, evidence_key: Optional[str] = None, layout: Optional[Any] = None) -> Dict[str, Any]:
    if not detect(text):
        return {
            "doc_type": None,
            "confidence": 0.0,
            "fields": {},
            "fields_clean": {},
            "warnings": ["Document did not match DBE/ACDBE Uniform Application"] if text else [],
            "evidence_key": evidence_key,
        }

    lines = _parse_lines(text)
    fields: Dict[str, Any] = {"doc": {"type": "DBE_ACDBE_Uniform_Application", "pii": True}}
    clean: Dict[str, Any] = {"doc": {"type": "DBE_ACDBE_Uniform_Application", "pii": True}}
    field_sources: Dict[str, str] = {}
    field_confidence: Dict[str, float] = {}
    warnings: List[str] = []

    # Section 1
    programs = []
    if re.search(r"DBE\s*\[[xX]\]", text):
        programs.append("DBE")
    if re.search(r"ACDBE\s*\[[xX]\]", text):
        programs.append("ACDBE")
    _assign(fields, ["dbe", "application", "programsSelected"], programs)
    _assign(clean, ["dbe", "application", "programsSelected"], programs)
    field_sources["dbe.application.programsSelected"] = "Section 1"
    field_confidence["dbe.application.programsSelected"] = 0.9

    home_ucp = _extract_line(lines, "Home State UCP")
    if home_ucp:
        _assign(fields, ["dbe", "application", "homeStateUCP"], home_ucp)
        _assign(clean, ["dbe", "application", "homeStateUCP"], home_ucp)
        field_sources["dbe.application.homeStateUCP"] = "Section 1"
        field_confidence["dbe.application.homeStateUCP"] = 0.9

    visits_raw = _extract_line(lines, "Site Visit History")
    visits = _parse_site_visits(visits_raw)
    if visits:
        _assign(fields, ["dbe", "application", "siteVisitDates"], visits)
        _assign(clean, ["dbe", "application", "siteVisitDates"], visits)
        field_sources["dbe.application.siteVisitDates"] = "Section 1"
        field_confidence["dbe.application.siteVisitDates"] = 0.85

    # Section 2
    biz: Dict[str, Any] = {}
    legal_name = _extract_line(lines, "Legal Business Name")
    if legal_name:
        biz["legalName"] = legal_name
        field_sources["biz.legalName"] = "Section 2"
        field_confidence["biz.legalName"] = 0.9
    primary_phone = _extract_line(lines, "Primary Phone")
    if primary_phone:
        raw_primary = primary_phone.split("  ")[0].strip()
        alt_match = re.search(r"Alternate Phone:\s*([0-9().\-\s]+)", primary_phone, re.IGNORECASE)
        fax_match = re.search(r"Fax:\s*([0-9().\-\s]+)", primary_phone, re.IGNORECASE)
        biz["primaryPhone"] = raw_primary
        if alt_match:
            biz["altPhone"] = alt_match.group(1).strip()
        if fax_match:
            biz["fax"] = fax_match.group(1).strip()
    email = _extract_line(lines, "Email")
    if email:
        parts = email.split("  ")
        biz["email"] = parts[0].strip()
        if len(parts) > 1 and "website" in parts[1].lower():
            website = parts[1].split(":", 1)[-1].strip()
            biz["websites"] = [website]
    street = _extract_line(lines, "Street Address")
    if street:
        biz["streetAddress"] = street
    mailing = _extract_line(lines, "Mailing Address")
    if mailing:
        biz["mailingAddress"] = mailing
    naics = _extract_line(lines, "NAICS Codes")
    if naics:
        codes = [code.strip() for code in re.split(r"[;,]", naics) if code.strip()]
        biz["naics"] = codes
    structure = _extract_line(lines, "Business Structure")
    if structure:
        biz["entityType"] = structure
    profit = _extract_line(lines, "For Profit")
    if profit:
        biz["forProfit"] = profit.strip().lower().startswith("y")
    est_date = _extract_line(lines, "Date Business Established")
    if est_date:
        biz["establishedDate"] = _normalize_date(est_date)
    owner_since = _extract_line(lines, "Ownership Since")
    if owner_since:
        biz["ownerSinceDate"] = _normalize_date(owner_since)
    acquired = _extract_line(lines, "Acquired How")
    if acquired:
        biz["acquisitionMethod"] = _categorize_acquisition(acquired)
    employees = next((line for line in lines if line.lower().startswith("employees:")), None)
    counts = _parse_employee_counts(employees)
    if any(v is not None for v in counts.values()):
        biz["employeeCounts"] = counts
    receipts = _parse_money_pairs(lines)
    if receipts:
        biz["grossReceipts"] = receipts
    shared = _extract_line(lines, "Shared Resources")
    if shared:
        entries = []
        for item in _split_entries(shared):
            if "with" in item.lower():
                before, after = item.split("with", 1)
                entries.append({"resource": before.strip(), "with": after.strip()})
            else:
                entries.append({"resource": item})
        biz["sharedResources"] = entries
    history = _extract_line(lines, "Other Ownership History")
    if history:
        entries = []
        for item in _split_entries(history):
            entries.append(item)
        biz["otherOwnershipHistory"] = entries

    if biz:
        fields["biz"] = biz
        clean["biz"] = _mask_value({
            "legalName": biz.get("legalName"),
            "primaryPhone": _normalize_phone(biz.get("primaryPhone", "")) if biz.get("primaryPhone") else None,
            "altPhone": _normalize_phone(biz.get("altPhone", "")) if biz.get("altPhone") else None,
            "fax": _normalize_phone(biz.get("fax", "")) if biz.get("fax") else None,
            "email": biz.get("email"),
            "websites": biz.get("websites"),
            "streetAddress": biz.get("streetAddress"),
            "mailingAddress": biz.get("mailingAddress"),
            "streetAddressParsed": _parse_address(biz.get("streetAddress")),
            "mailingAddressParsed": _parse_address(biz.get("mailingAddress")),
            "naics": biz.get("naics"),
            "entityType": biz.get("entityType"),
            "forProfit": biz.get("forProfit"),
            "establishedDate": biz.get("establishedDate"),
            "ownerSinceDate": biz.get("ownerSinceDate"),
            "acquisitionMethod": biz.get("acquisitionMethod"),
            "employeeCounts": counts,
            "grossReceipts": receipts,
            "sharedResources": biz.get("sharedResources"),
            "otherOwnershipHistory": biz.get("otherOwnershipHistory"),
        })
        field_sources["biz"] = "Section 2"
        field_confidence["biz"] = 0.88

    # Owners
    owners: List[Dict[str, Any]] = []
    section3_match = re.search(r"Section 3[A-B].+?(?=Section\s+4:|ACDBE Section|Affidavit|Supporting Documents|$)", text, re.IGNORECASE | re.DOTALL)
    if section3_match:
        section3 = section3_match.group(0)
        for parsed in _parse_owner_blocks(section3):
            owner = _parse_owner(parsed.raw_block)
            if owner:
                owners.append(_mask_value(owner))
    if owners:
        clean["owners"] = owners
        fields["owners"] = owners
        field_sources["owners"] = "Section 3"
        field_confidence["owners"] = 0.9
    else:
        warnings.append("Owner information missing")

    # Control Section
    section4_match = re.search(r"Section 4.+?(?=ACDBE Section|Affidavit|Supporting Documents|$)", text, re.IGNORECASE | re.DOTALL)
    control: Dict[str, Any] = {}
    if section4_match:
        section4 = section4_match.group(0)
        control["officers"] = _extract_control_lists(section4, "Officers")
        control["directors"] = _extract_control_lists(section4, "Directors")
        duties = _parse_duties(section4)
        if duties:
            control["duties"] = duties
        inventory = _parse_equipment(section4)
        for key, value in inventory.items():
            if value:
                control[key] = value
        finance = _parse_finance(section4)
        control.update(finance)
        licenses = _parse_list_section(section4, "Licenses")
        if licenses:
            control["licenses"] = licenses
        largest = _parse_list_section(section4, "Largest Contracts")
        if largest:
            control["largestContracts"] = largest
        active = _parse_list_section(section4, "Active Jobs")
        if active:
            control["activeJobs"] = active
    if control:
        control_masked = _mask_value(control)
        fields["control"] = control_masked
        clean["control"] = control_masked
        field_sources["control"] = "Section 4"
        field_confidence["control"] = 0.86

    # ACDBE Section
    acdbe_match = re.search(r"ACDBE Section.+?(?=Affidavit|Supporting Documents|$)", text, re.IGNORECASE | re.DOTALL)
    acdbe_section: Dict[str, Any] = {}
    if acdbe_match:
        section = acdbe_match.group(0)
        concessions = _parse_list_section(section, "Concession Spaces")
        other_conc = _parse_list_section(section, "Other Concessions")
        acdbe: Dict[str, Any] = {}
        if concessions:
            acdbe["concessionSpaces"] = concessions
        if other_conc:
            acdbe["otherConcessions"] = other_conc
        if acdbe:
            fields.setdefault("acdbe", {}).update(acdbe)
            clean.setdefault("acdbe", {}).update(acdbe)
            field_sources["acdbe"] = "ACDBE Section"
            field_confidence["acdbe"] = 0.85
            acdbe_section = acdbe

    affidavit_match = re.search(
        r"Affidavit of Certification\s+Signed by\s+([^,]+),\s*([^\n]+)\s+on\s+([^\n]+)",
        text,
        re.IGNORECASE,
    )
    if affidavit_match:
        affidavit = {
            "present": True,
            "signer": affidavit_match.group(1).strip(),
            "title": affidavit_match.group(2).strip(),
            "date": _normalize_date(affidavit_match.group(3)),
        }
        fields["affidavit"] = affidavit
        clean["affidavit"] = affidavit
        field_sources["affidavit"] = "Affidavit"
        field_confidence["affidavit"] = 0.9
    else:
        warnings.append("Affidavit signature missing")

    # Eligibility aliases
    concession_entries: List[Dict[str, Any]] = []
    for entry in acdbe_section.get("concessionSpaces", []):
        concession_entries.append({"type": "space", "description": entry})
    for entry in acdbe_section.get("otherConcessions", []):
        concession_entries.append({"type": "other", "description": entry})

    eligibility: Dict[str, Any] = {
        "company.name": biz.get("legalName") if biz else None,
        "company.address": _parse_address(biz.get("streetAddress")) if biz else None,
        "company.mailing_address": _parse_address(biz.get("mailingAddress")) if biz else None,
        "company.naics": biz.get("naics") if biz else None,
        "owners": [
            {
                "name": owner.get("fullName"),
                "percent": owner.get("ownershipPct"),
                "citizenship": owner.get("citizenship"),
                "ethnicity": owner.get("ethnicity"),
            }
            for owner in owners
        ],
        "officers": control.get("officers") if control else None,
        "licenses": control.get("licenses") if control else None,
        "revenue.history": receipts if receipts else None,
        "employees.counts": counts if counts else None,
        "bank.bonding": control.get("bonding") if control.get("bonding") else None,
        "contracts.history": control.get("largestContracts") if control.get("largestContracts") else None,
        "concessions": concession_entries or None,
    }
    clean["eligibility"] = _mask_value(eligibility)

    payload = {
        "doc_type": "DBE_ACDBE_Uniform_Application",
        "confidence": 0.92,
        "fields": _mask_value(fields),
        "fields_clean": _mask_value(clean),
        "field_sources": field_sources,
        "field_confidence": field_confidence,
        "warnings": warnings,
        "evidence_key": evidence_key,
        "metadata": {"layoutProvided": bool(layout)},
    }
    return payload


__all__ = ["detect", "extract"]
