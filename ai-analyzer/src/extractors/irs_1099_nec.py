from __future__ import annotations

import logging
import re
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

FORM_RE = re.compile(r"form\s+1099[-\u2011]?nec", re.IGNORECASE)
TITLE_RE = re.compile(r"nonemployee\s+comp(?:ensation)?", re.IGNORECASE)
OMB_RE = re.compile(r"OMB\s+No\.?\s*1545-0116", re.IGNORECASE)
COPY_RE = re.compile(r"copy\s+(?:a|b|1|2)\b", re.IGNORECASE)
URL_RE = re.compile(r"irs\.gov/\s*form1099nec", re.IGNORECASE)
BOX_LABEL_RE = re.compile(
    r"(?im)^\s*([1-7])\s+(Nonemployee|Payer made direct sales|Excess golden parachute|Federal income tax withheld|State tax withheld|State/Payer's state no\.?|State income)"
)
CHECK_TRUE_RE = re.compile(r"(☑|☒|✅|✔|\[\s*[xX]\s*\]|\(\s*[xX]\s*\)|\b[Xx]\b)")
CHECK_FALSE_RE = re.compile(r"(☐|\[\s*\])")

TAX_YEAR_RE = re.compile(r"For\s+calendar\s+year\s+(20\d{2})", re.IGNORECASE)
PHONE_RE = re.compile(r"Phone\s*[:\-]?\s*([\d()\-\s\.]+)", re.IGNORECASE)
ACCOUNT_RE = re.compile(r"Account\s+number\s*[:\-]?\s*(.+)$", re.IGNORECASE)
STATE_SPLIT_RE = re.compile(r"[,/]|\s{2,}")

BOX_PATTERNS = {
    "box1_nonemployee_comp": re.compile(
        r"(?im)^\s*1\s+Nonemployee\s+comp(?:ensation)?[^0-9\n]*([\$0-9,()\.-]+)"
    ),
    "box3_excess_golden_parachute": re.compile(
        r"(?im)^\s*3\s+Excess\s+golden\s+parachute[^0-9\n]*([\$0-9,()\.-]+)"
    ),
    "box4_federal_income_tax_wh": re.compile(
        r"(?im)^\s*4\s+Federal\s+income\s+tax\s+withheld[^0-9\n]*([\$0-9,()\.-]+)"
    ),
    "box5_state_tax_wh": re.compile(
        r"(?im)^\s*5\s+State\s+tax\s+withheld[^0-9\n]*([\$0-9,()\.-]+(?:\s+[\$0-9,()\.-]+)*)"
    ),
    "box7_state_income": re.compile(
        r"(?im)^\s*7\s+State\s+income[^0-9\n]*([\$0-9,()\.-]+(?:\s+[\$0-9,()\.-]+)*)"
    ),
}

MULTI_VALUE_BOXES = {"box5_state_tax_wh", "box7_state_income"}


def detect(text: str) -> bool:
    if not text:
        return False
    lowered = text.lower()
    score = 0.0
    if FORM_RE.search(lowered):
        score += 0.4
    if TITLE_RE.search(lowered):
        score += 0.25
    if OMB_RE.search(text):
        score += 0.1
    if COPY_RE.search(text):
        score += 0.1
    if URL_RE.search(lowered):
        score += 0.1
    if len(BOX_LABEL_RE.findall(text)) >= 3:
        score += 0.15
    return score >= 0.6


def _parse_money(token: str) -> Optional[float]:
    cleaned = (token or "").strip()
    if not cleaned:
        return None
    cleaned = cleaned.replace("$", "").replace(",", "")
    cleaned = cleaned.replace("O", "0").replace("o", "0")
    cleaned = cleaned.replace("—", "-")
    if cleaned.startswith("(") and cleaned.endswith(")"):
        cleaned = f"-{cleaned[1:-1]}"
    cleaned = re.sub(r"[^0-9.\-]", "", cleaned)
    if cleaned in {"", "-", "."}:
        return None
    try:
        return float(Decimal(cleaned))
    except (InvalidOperation, ValueError):
        return None


def _normalize_whitespace(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def _normalize_tin(value: Optional[str]) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    if not value:
        return None, None, None
    digits = re.sub(r"\D", "", value)
    masked = None
    last4 = digits[-4:] if len(digits) >= 4 else None
    if last4:
        masked = f"***-**-{last4}"
    if len(digits) == 9:
        return digits, masked, last4
    return None, masked, last4


def _checkbox_value(line: str, label: Optional[str] = None) -> Optional[bool]:
    if not line:
        return None
    snippet = line
    if label:
        match = re.search(rf"{label}[^\n]*", line, re.IGNORECASE)
        if match:
            snippet = match.group(0)
    true = CHECK_TRUE_RE.search(snippet)
    false = CHECK_FALSE_RE.search(snippet)
    if true and not false:
        return True
    if false and not true:
        return False
    lowered = snippet.lower()
    if "yes" in lowered:
        return True
    if "no" in lowered:
        return False
    return None


def _extract_labeled(
    lines: List[str], patterns: List[re.Pattern[str]], *, join_next: int = 0
) -> Tuple[Optional[str], Optional[int]]:
    for idx, line in enumerate(lines):
        for pat in patterns:
            match = pat.search(line)
            if match:
                tail = line[match.end() :].strip(" :\t-·")
                parts = [tail] if tail else []
                for offset in range(1, join_next + 1):
                    if idx + offset >= len(lines):
                        break
                    nxt = lines[idx + offset].strip()
                    if not nxt:
                        break
                    parts.append(nxt)
                value = _normalize_whitespace(" ".join(filter(None, parts)))
                return value or None, idx
    return None, None


def _extract_box_values(
    pattern: re.Pattern[str], text: str, allow_multi: bool = False
) -> Tuple[List[str], List[float]]:
    match = pattern.search(text)
    if not match:
        return [], []
    raw = match.group(1).strip()
    if allow_multi:
        tokens = [tok.strip() for tok in re.findall(r"\(?[\$0-9,\.\-]+\)?", raw) if tok.strip()]
    else:
        tokens = [raw]
    raw_values: List[str] = []
    clean_values: List[float] = []
    for token in tokens:
        value = token.strip()
        if not value:
            continue
        if allow_multi and value.isdigit() and len(value) <= 2:
            continue
        if value.endswith(')') and '(' not in value:
            numeric_candidate = re.sub(r'[^0-9.]', '', value)
            if numeric_candidate:
                value = f'({value}'
        raw_values.append(value)
        parsed = _parse_money(value)
        if parsed is not None:
            clean_values.append(parsed)
    if not raw_values and raw:
        raw_values.append(raw)
        parsed = _parse_money(raw)
        if parsed is not None:
            clean_values.append(parsed)
    return raw_values, clean_values


def extract(text: str, evidence_key: Optional[str] = None) -> Dict[str, Any]:
    lines = [line.rstrip("\n") for line in text.splitlines()]
    stripped_lines = [line.strip() for line in lines]

    fields: Dict[str, Any] = {}
    fields_clean: Dict[str, Any] = {}
    field_sources: Dict[str, Dict[str, Any]] = {}
    field_confidence: Dict[str, float] = {}
    warnings: List[str] = []

    payer_name, payer_name_idx = _extract_labeled(
        stripped_lines,
        [re.compile(r"Payer'?s\s+name[:\-]?", re.IGNORECASE)],
        join_next=0,
    )
    if payer_name:
        fields["payer_name"] = payer_name
        fields_clean["payer_name"] = payer_name
        field_sources["payer_name"] = {"page": 1, "line": (payer_name_idx or 0) + 1, "raw": payer_name}
        field_confidence["payer_name"] = 0.9

    payer_address, payer_address_idx = _extract_labeled(
        stripped_lines,
        [re.compile(r"Street\s+address[:\-]?", re.IGNORECASE)],
        join_next=1,
    )
    if payer_address:
        fields["payer_address"] = payer_address
        fields_clean["payer_address"] = payer_address
        field_sources["payer_address"] = {
            "page": 1,
            "line": (payer_address_idx or 0) + 1,
            "raw": payer_address,
        }
        field_confidence["payer_address"] = 0.85

    payer_phone = None
    payer_phone_idx = None
    for idx, line in enumerate(stripped_lines):
        match = PHONE_RE.search(line)
        if match:
            payer_phone = _normalize_whitespace(match.group(1))
            payer_phone_idx = idx
            break
    if payer_phone:
        fields["payer_phone"] = payer_phone
        fields_clean["payer_phone"] = payer_phone
        field_sources["payer_phone"] = {
            "page": 1,
            "line": (payer_phone_idx or 0) + 1,
            "raw": payer_phone,
        }
        field_confidence["payer_phone"] = 0.6

    payer_tin_value, payer_tin_idx = _extract_labeled(
        stripped_lines,
        [re.compile(r"Payer'?s\s+TIN[:\-]?", re.IGNORECASE)],
        join_next=0,
    )
    if payer_tin_value:
        clean_tin, masked_tin, last4 = _normalize_tin(payer_tin_value)
        if clean_tin:
            fields_clean["payer_tin"] = clean_tin
            fields["payer_tin"] = clean_tin
            field_confidence["payer_tin"] = 0.9
        else:
            warnings.append("invalid_payer_tin")
        if masked_tin:
            fields_clean["payer_tin_masked"] = masked_tin
            field_confidence["payer_tin_masked"] = 0.9
        if last4:
            fields_clean["payer_tin_last4"] = last4
            field_confidence["payer_tin_last4"] = 0.9
        field_sources["payer_tin"] = {
            "page": 1,
            "line": (payer_tin_idx or 0) + 1,
            "raw": payer_tin_value,
        }
        field_sources["payer_tin_masked"] = field_sources["payer_tin"]
        field_sources["payer_tin_last4"] = field_sources["payer_tin"]

    recipient_name, recipient_name_idx = _extract_labeled(
        stripped_lines,
        [re.compile(r"Recipient'?s\s+name[:\-]?", re.IGNORECASE)],
        join_next=0,
    )
    if recipient_name:
        fields["recipient_name"] = recipient_name
        fields_clean["recipient_name"] = recipient_name
        field_sources["recipient_name"] = {
            "page": 1,
            "line": (recipient_name_idx or 0) + 1,
            "raw": recipient_name,
        }
        field_confidence["recipient_name"] = 0.9

    recipient_address, recipient_addr_idx = _extract_labeled(
        stripped_lines,
        [re.compile(r"Street\s+address\s*\(including\s+apt\.?", re.IGNORECASE)],
        join_next=1,
    )
    if recipient_address:
        fields["recipient_address"] = recipient_address
        fields_clean["recipient_address"] = recipient_address
        field_sources["recipient_address"] = {
            "page": 1,
            "line": (recipient_addr_idx or 0) + 1,
            "raw": recipient_address,
        }
        field_confidence["recipient_address"] = 0.85

    recipient_tin_value, recipient_tin_idx = _extract_labeled(
        stripped_lines,
        [re.compile(r"Recipient'?s\s+TIN[:\-]?", re.IGNORECASE)],
        join_next=0,
    )
    if recipient_tin_value:
        clean_tin, masked_tin, last4 = _normalize_tin(recipient_tin_value)
        if clean_tin:
            fields_clean["recipient_tin"] = clean_tin
            fields["recipient_tin"] = clean_tin
            field_confidence["recipient_tin"] = 0.9
        else:
            warnings.append("invalid_recipient_tin")
        if masked_tin:
            fields_clean["recipient_tin_masked"] = masked_tin
            field_confidence["recipient_tin_masked"] = 0.9
        if last4:
            fields_clean["recipient_tin_last4"] = last4
            field_confidence["recipient_tin_last4"] = 0.9
        field_sources["recipient_tin"] = {
            "page": 1,
            "line": (recipient_tin_idx or 0) + 1,
            "raw": recipient_tin_value,
        }
        field_sources["recipient_tin_masked"] = field_sources["recipient_tin"]
        field_sources["recipient_tin_last4"] = field_sources["recipient_tin"]

    account_number = None
    account_idx = None
    for idx, line in enumerate(stripped_lines):
        match = ACCOUNT_RE.search(line)
        if match:
            account_number = _normalize_whitespace(match.group(1))
            account_idx = idx
            break
    if account_number:
        fields["account_number"] = account_number
        fields_clean["account_number"] = account_number
        field_sources["account_number"] = {
            "page": 1,
            "line": (account_idx or 0) + 1,
            "raw": account_number,
        }
        field_confidence["account_number"] = 0.6

    tax_year_match = TAX_YEAR_RE.search(text)
    if tax_year_match:
        tax_year = tax_year_match.group(1)
        fields_clean["tax_year"] = tax_year
        field_confidence["tax_year"] = 0.8
        field_sources["tax_year"] = {"page": 1, "line": 1, "raw": tax_year_match.group(0)}

    void_value = None
    corrected_value = None
    for idx, line in enumerate(stripped_lines[:5]):
        if "void" in line.lower():
            void_value = _checkbox_value(line, label="void")
            field_sources["void"] = {
                "page": 1,
                "line": idx + 1,
                "raw": stripped_lines[idx],
            }
        if "corrected" in line.lower():
            corrected_value = _checkbox_value(line, label="corrected")
            field_sources["corrected"] = {
                "page": 1,
                "line": idx + 1,
                "raw": stripped_lines[idx],
            }
    if void_value is not None:
        fields_clean["void"] = bool(void_value)
        field_confidence["void"] = 0.6
    if corrected_value is not None:
        fields_clean["corrected"] = bool(corrected_value)
        field_confidence["corrected"] = 0.6

    box2_value = None
    for idx, line in enumerate(stripped_lines):
        if line.lower().startswith("2 payer"):
            box2_value = _checkbox_value(line, label="payer")
            field_sources["box2_direct_sales_over_5000"] = {
                "page": 1,
                "line": idx + 1,
                "raw": stripped_lines[idx],
            }
            break
    if box2_value is not None:
        fields_clean["box2_direct_sales_over_5000"] = bool(box2_value)
        field_confidence["box2_direct_sales_over_5000"] = 0.75

    for key, pattern in BOX_PATTERNS.items():
        raw_values, parsed_values = _extract_box_values(
            pattern, text, allow_multi=key in MULTI_VALUE_BOXES
        )
        if not raw_values and not parsed_values:
            continue
        if key in MULTI_VALUE_BOXES and len(parsed_values) > 1:
            fields_clean[key] = parsed_values
            fields[key] = raw_values
        else:
            value_clean = parsed_values[0] if parsed_values else None
            value_raw = raw_values[0] if raw_values else None
            fields_clean[key] = value_clean
            fields[key] = value_raw
        field_confidence[key] = 0.85
        field_sources[key] = {
            "page": 1,
            "line": next(
                (idx + 1 for idx, line in enumerate(stripped_lines) if pattern.search(line)),
                1,
            ),
            "raw": raw_values if len(raw_values) > 1 else (raw_values[0] if raw_values else ""),
        }

    state_raw, state_idx = _extract_labeled(
        stripped_lines,
        [re.compile(r"State/Payer'?s\s+state\s+no\.", re.IGNORECASE)],
        join_next=0,
    )
    if state_raw:
        tokens = [tok.strip() for tok in STATE_SPLIT_RE.split(state_raw) if tok.strip()]
        value: Any = tokens if len(tokens) > 1 else (tokens[0] if tokens else state_raw)
        fields_clean["box6_state_payer_state_no"] = value
        fields["box6_state_payer_state_no"] = value
        field_confidence["box6_state_payer_state_no"] = 0.8
        field_sources["box6_state_payer_state_no"] = {
            "page": 1,
            "line": (state_idx or 0) + 1,
            "raw": state_raw,
        }

    if fields_clean.get("box1_nonemployee_comp") in (None, [], ""):
        warnings.append("missing_box1")

    state_lengths = []
    for key in ("box5_state_tax_wh", "box6_state_payer_state_no", "box7_state_income"):
        value = fields_clean.get(key)
        if isinstance(value, list):
            state_lengths.append(len(value))
        elif value is not None:
            state_lengths.append(1)
    if state_lengths and len(set(state_lengths)) > 1:
        warnings.append("state_box_length_mismatch")

    doc_conf = 0.55
    if FORM_RE.search(text):
        doc_conf += 0.15
    if TITLE_RE.search(text):
        doc_conf += 0.1
    if fields_clean.get("box1_nonemployee_comp"):
        doc_conf += 0.1
    if fields_clean.get("payer_tin") and fields_clean.get("recipient_tin"):
        doc_conf += 0.1
    if fields_clean.get("box4_federal_income_tax_wh") is not None:
        doc_conf += 0.05
    doc_conf = min(doc_conf, 0.95)
    if warnings:
        doc_conf = max(0.35, doc_conf - 0.1 * len(warnings))

    logger.info(
        "irs_1099_nec.extract",
        extra={
            "found": sorted(fields_clean.keys()),
            "warnings": warnings,
            "evidence_key": evidence_key,
        },
    )

    return {
        "doc_type": "1099_NEC",
        "confidence": doc_conf,
        "fields": fields,
        "fields_clean": fields_clean,
        "field_confidence": field_confidence,
        "field_sources": field_sources,
        "warnings": warnings,
        "evidence_key": evidence_key,
    }


__all__ = ["detect", "extract"]
