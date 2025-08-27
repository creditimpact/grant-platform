"""Smarter form filling utilities."""
import ast
import json
import time
import re
from pathlib import Path
from typing import Dict, Any, Optional
from datetime import datetime
import operator as op
from common.logger import get_logger
from config import settings
from document_utils import extract_fields, guess_attachment
from nlp_utils import normalize_text_field, infer_state_from_zip, llm_complete

FORM_DIR = Path(__file__).parent / "form_templates"
logger = get_logger(__name__)

ZIP_STATE = {
    "9": "CA",
    "1": "NY",
    "6": "IL",
}

US_STATE_ABBR = {
    "ALABAMA": "AL",
    "ALASKA": "AK",
    "ARIZONA": "AZ",
    "ARKANSAS": "AR",
    "CALIFORNIA": "CA",
    "COLORADO": "CO",
    "CONNECTICUT": "CT",
    "DELAWARE": "DE",
    "FLORIDA": "FL",
    "GEORGIA": "GA",
    "HAWAII": "HI",
    "IDAHO": "ID",
    "ILLINOIS": "IL",
    "INDIANA": "IN",
    "IOWA": "IA",
    "KANSAS": "KS",
    "KENTUCKY": "KY",
    "LOUISIANA": "LA",
    "MAINE": "ME",
    "MARYLAND": "MD",
    "MASSACHUSETTS": "MA",
    "MICHIGAN": "MI",
    "MINNESOTA": "MN",
    "MISSISSIPPI": "MS",
    "MISSOURI": "MO",
    "MONTANA": "MT",
    "NEBRASKA": "NE",
    "NEVADA": "NV",
    "NEW HAMPSHIRE": "NH",
    "NEW JERSEY": "NJ",
    "NEW MEXICO": "NM",
    "NEW YORK": "NY",
    "NORTH CAROLINA": "NC",
    "NORTH DAKOTA": "ND",
    "OHIO": "OH",
    "OKLAHOMA": "OK",
    "OREGON": "OR",
    "PENNSYLVANIA": "PA",
    "RHODE ISLAND": "RI",
    "SOUTH CAROLINA": "SC",
    "SOUTH DAKOTA": "SD",
    "TENNESSEE": "TN",
    "TEXAS": "TX",
    "UTAH": "UT",
    "VERMONT": "VT",
    "VIRGINIA": "VA",
    "WASHINGTON": "WA",
    "WEST VIRGINIA": "WV",
    "WISCONSIN": "WI",
    "WYOMING": "WY",
}

ZIP_RE = re.compile(r"^(\d{5})(?:[-\s]?(\d{4}))?$")

# Fields that should be normalised to "yes"/"no" when boolean or other variants
YES_NO_FIELDS = {
    "construction_cash_cost_exceeds_10k",
    "exemption_applies",
    "include_equal_opportunity_clause",
    "notify_unions",
    "advertising_statement_included",
    "reporting_access_agreed",
    "exec_order_compliance_agreed",
    "subcontractor_flowdown_agreed",
    "debarred_contractor_blocked",
    "rd_400_6_required",
    "ad_425_included",
    "ad_560_required",
    "cc_257_required",
}

def _normalize_state(value: str) -> str:
    if not value:
        return value
    v = value.strip()
    if len(v) == 2 and v.isalpha():
        return v.upper()
    return US_STATE_ABBR.get(v.strip().upper(), v.strip())

def _normalize_zip(value: str) -> str:
    if not value:
        return value
    v = str(value).strip()
    m = ZIP_RE.match(v)
    if m:
        return m.group(1) + ("-" + m.group(2) if m.group(2) else "")
    digits = re.sub(r"\D", "", v)
    if len(digits) >= 5:
        first = digits[:5]
        rest = digits[5:9]
        return first + ("-" + rest if len(rest) == 4 else "")
    return v


def _to_float(value: Any) -> float:
    """Convert ``value`` to a float rounded to 2 decimals."""
    if value in (None, ""):
        return 0.0
    if isinstance(value, (int, float)):
        return round(float(value), 2)
    if isinstance(value, str):
        try:
            return round(float(value.replace("$", "").replace(",", "")), 2)
        except ValueError:
            return 0.0
    return 0.0

SAFE_FUNCTIONS = {"int": int, "float": float}

MAX_AST_NODES = 100
MAX_STRING_LENGTH = 1000
MAX_NUMBER_ABS = 10**9

ENTITY_TYPE_MAP = {
    "llc": "LLC",
    "c-corp": "C-Corp",
    "c corp": "C-Corp",
    "c corporation": "C-Corp",
    "s-corp": "S-Corp",
    "s corp": "S-Corp",
    "s corporation": "S-Corp",
    "sole proprietor": "Sole Proprietor",
    "sole proprietorship": "Sole Proprietor",
}


def _flatten_dict(d: Dict[str, Any], parent_key: str = "", sep: str = "_") -> Dict[str, Any]:
    items = []
    for k, v in d.items():
        new_key = f"{parent_key}{sep}{k}" if parent_key else k
        if isinstance(v, dict):
            items.extend(_flatten_dict(v, new_key, sep).items())
        else:
            items.append((new_key, v))
    return dict(items)


def _flatten_stats_fields(data: Dict[str, Any]) -> Dict[str, Any]:
    flat = _flatten_dict(data)
    cleaned: Dict[str, Any] = {}
    replacements = {
        "section_i_statistical_information_": "",
        "section_ii_application_information_": "",
        "section_iii_location_of_facility_": "",
        "section_iv_use_of_services_and_facilities_": "",
        "section_v_accessibility_requirements_disability_": "",
        "section_vi_accessibility_requirements_rural_rental_": "",
        "section_vii_accessibility_health_care_": "",
        "section_viii_housing_facilities_": "",
        "section_ix_employment_programs_": "",
        "section_x_individual_contacts_": "",
        "section_xi_community_contacts_": "",
        "section_xii_past_assistance_": "",
        "section_xiii_civil_rights_history_": "",
        "section_xiv_conclusions_": "",
        "section_xv_non_compliance_": "",
        "header_information_": "",
        "certification_": "",
        "_participants_": "_",
        "_ethnicity_": "_",
        "_race_": "_",
        "_board_of_directors_": "_board_",
    }
    ethnicity_map = {
        "hispanic_or_latino": "hispanic",
        "not_hispanic_or_latino": "not_hispanic",
        "american_indian_alaskan_native": "american_indian",
        "native_hawaiian_other_pacific_islander": "native_hawaiian",
        "black_or_african_american": "black",
    }
    for k, v in flat.items():
        nk = k
        for old, new in replacements.items():
            nk = nk.replace(old, new)
        for old, new in ethnicity_map.items():
            nk = nk.replace(old, new)
        nk = nk.replace("__", "_")
        cleaned[nk] = v
    return cleaned


def _canonical_entity_type(value: str) -> str:
    key = value.strip().lower().replace(".", "").replace(",", "")
    return ENTITY_TYPE_MAP.get(key, value.strip())


def safe_eval(
    expr: str,
    names: Dict[str, Any],
    *,
    max_nodes: int = MAX_AST_NODES,
    max_string_length: int = MAX_STRING_LENGTH,
    max_number: int = MAX_NUMBER_ABS,
) -> Any:
    """Safely evaluate a limited Python expression.

    Only a small subset of Python is supported: arithmetic operations,
    boolean logic, comparisons and calls to whitelisted helper functions.
    Any attempt to use other syntax or names will raise ``ValueError``.
    Expressions that exceed ``max_nodes`` AST nodes or contain overly
    large constants are rejected to avoid resource exhaustion.
    """

    def _eval(node: ast.AST) -> Any:
        if isinstance(node, ast.Expression):
            return _eval(node.body)
        if isinstance(node, ast.Constant):
            val = node.value
            if isinstance(val, str):
                if len(val) > max_string_length:
                    raise ValueError("String constant too long")
                return val
            if isinstance(val, (int, float)):
                if abs(val) > max_number:
                    raise ValueError("Numeric constant too large")
                return val
            if isinstance(val, (bool, type(None))):
                return val
            raise ValueError("Unsupported constant type")
        if isinstance(node, ast.Name):
            if node.id in context:
                return context[node.id]
            raise ValueError(f"Unknown variable: {node.id}")
        if isinstance(node, ast.BinOp):
            bin_ops = {
                ast.Add: op.add,
                ast.Sub: op.sub,
                ast.Mult: op.mul,
                ast.Div: op.truediv,
                ast.Mod: op.mod,
            }
            if type(node.op) in bin_ops:
                return bin_ops[type(node.op)](_eval(node.left), _eval(node.right))
            raise ValueError("Unsupported binary operator")
        if isinstance(node, ast.UnaryOp):
            unary_ops = {ast.UAdd: op.pos, ast.USub: op.neg, ast.Not: op.not_}
            if type(node.op) in unary_ops:
                return unary_ops[type(node.op)](_eval(node.operand))
            raise ValueError("Unsupported unary operator")
        if isinstance(node, ast.BoolOp):
            if isinstance(node.op, ast.And):
                return all(_eval(v) for v in node.values)
            if isinstance(node.op, ast.Or):
                return any(_eval(v) for v in node.values)
            raise ValueError("Unsupported boolean operator")
        if isinstance(node, ast.Compare):
            cmp_ops = {
                ast.Eq: op.eq,
                ast.NotEq: op.ne,
                ast.Lt: op.lt,
                ast.LtE: op.le,
                ast.Gt: op.gt,
                ast.GtE: op.ge,
            }
            left = _eval(node.left)
            for oper, comp in zip(node.ops, node.comparators):
                if type(oper) not in cmp_ops:
                    raise ValueError("Unsupported comparison operator")
                right = _eval(comp)
                if not cmp_ops[type(oper)](left, right):
                    return False
                left = right
            return True
        if isinstance(node, ast.Call):
            if isinstance(node.func, ast.Name) and node.func.id in SAFE_FUNCTIONS:
                func = SAFE_FUNCTIONS[node.func.id]
                if node.keywords:
                    raise ValueError("Keyword arguments not allowed")
                args = [_eval(arg) for arg in node.args]
                return func(*args)
            raise ValueError("Function calls are not allowed")
        raise ValueError(f"Unsupported expression: {type(node).__name__}")

    try:
        tree = ast.parse(expr, mode="eval")
    except SyntaxError as exc:  # pragma: no cover - ast raises SyntaxError
        raise ValueError("Invalid expression") from exc

    if sum(1 for _ in ast.walk(tree)) > max_nodes:
        raise ValueError("Expression too complex")

    sanitized: Dict[str, Any] = {}
    for key, value in names.items():
        if "__" in key:
            raise ValueError("Invalid variable name")
        if callable(value):
            raise ValueError("Callable values are not allowed")
        if key in SAFE_FUNCTIONS:
            raise ValueError("Overriding safe functions is not allowed")
        sanitized[key] = value

    context = {**SAFE_FUNCTIONS, **sanitized}
    return _eval(tree.body)


def _generate_text(data: Dict[str, Any], example: str | None = None) -> str:
    """Create a simple free text description based on available fields."""
    if example:
        return example
    parts = ["Our"]
    if "industry" in data:
        parts.append(f"{data['industry']}")
    parts.append("business")
    if "employees" in data:
        parts.append(f"with {data['employees']} employees")
    if "city" in data:
        parts.append(f"based in {data['city']}")
    return " ".join(parts) + "."


def _fill_template(
    template: Dict[str, Any],
    data: Dict[str, Any],
    reasoning: list[str] | None = None,
    *,
    form_name: str | None = None,
) -> Dict[str, Any]:
    fields = template.get("fields", {})
    # Some templates provide fields as lists (e.g. complex government forms).
    # In that case we simply recurse into any nested dictionaries but otherwise
    # leave the structure untouched.
    if isinstance(fields, list):
        processed = []
        for item in fields:
            if isinstance(item, dict):
                processed.append(_fill_template(item, data, reasoning, form_name=form_name))
            else:
                processed.append(item)
        template["fields"] = processed
        fields = {}
    optional = template.get("optional_fields", {})
    computed = template.get("computed_fields", {})
    conditional = template.get("conditional_fields", {})

    # evaluate computed fields in the context of data
    for key, expr in computed.items():
        try:
            ctx = dict(data)
            ctx["current_year"] = datetime.utcnow().year
            data[key] = safe_eval(expr, ctx)
            if reasoning is not None:
                reasoning.append(f"{key} computed from expression")
        except Exception:
            data[key] = ""

    # derive state from zip if missing
    if "state" not in data and "zip" in data:
        z = str(data["zip"])
        for prefix, state in ZIP_STATE.items():
            if z.startswith(prefix):
                data["state"] = state
                if reasoning is not None:
                    reasoning.append("state inferred from zip")
                break
        if "state" not in data:
            guessed = infer_state_from_zip(z)
            if guessed:
                data["state"] = guessed
                if reasoning is not None:
                    reasoning.append("state inferred from zip")

    # simple conditional logic
    for key, rule in conditional.items():
        expr = rule.get("if")
        val = rule.get("value", True)
        try:
            ctx = dict(data)
            if safe_eval(expr, ctx):
                data[key] = val
        except Exception:
            pass

    merged: Dict[str, Any] = {}
    attachments: Dict[str, str] = {}
    sources: Dict[str, str] = {}
    FIELD_KEYS = {
        "default",
        "required",
        "type",
        "depends_on",
        "prompt",
        "show_if",
        "required_if",
        "example",
        "expected_file",
    }
    for k, spec in fields.items():
        if isinstance(spec, dict):
            if (
                "fields" in spec
                or "sections" in spec
                or (not (FIELD_KEYS & spec.keys()) and any(isinstance(v, dict) for v in spec.values()))
            ):
                merged[k] = _fill_template(spec, data, reasoning)
                continue
            default = spec.get("default", "")
            required = spec.get("required", True)
            ftype = spec.get("type", "text")
            ftype = {"string": "text", "enum": "dropdown", "boolean": "checkbox"}.get(ftype, ftype)
            depends = spec.get("depends_on")
            prompt = spec.get("prompt")
            show_if = spec.get("show_if")
            required_if = spec.get("required_if")
            example = spec.get("example")
            expected_file = spec.get("expected_file")
        else:
            default = spec
            required = True
            ftype = "text"
            depends = None
            prompt = None
            show_if = None
            required_if = None
            example = None
            expected_file = None

        if depends and not data.get(depends):
            continue

        if show_if:
            try:
                ctx = dict(data)
                if not safe_eval(show_if, ctx):
                    continue
            except Exception:
                pass

        if required_if:
            try:
                ctx = dict(data)
                required = bool(safe_eval(required_if, ctx))
            except Exception:
                pass

        value = data.get(k)
        if k in data and reasoning is not None:
            reasoning.append(f"{k} provided by user")
        if isinstance(value, str):
            # Skip normalization for date-like fields to avoid stripping
            # separators. ``normalize_text_field`` would treat values such as
            # "2024-10-19" as numeric and convert them to ``2024``. For
            # any explicitly typed date field or keys containing "date", we
            # therefore keep the original string value.
            if ftype != "date" and "date" not in k.lower():
                _, value = normalize_text_field(k, value)
        if value is None:
            if k in optional:
                value = optional[k]
            else:
                value = default
                if value is None and required:
                    value = ""

        if ftype in {"text", "textarea"} and not value:
            if prompt:
                if not getattr(settings, "OPENAI_API_KEY", None):
                    logger.info(
                        "llm_fallback",
                        extra={"form": form_name, "field": k, "reason": "missing_api_key"},
                    )
                else:
                    est_tokens = (len(prompt) + len(json.dumps(data))) // 4
                    logger.info(
                        "llm_invocation",
                        extra={
                            "form": form_name,
                            "field": k,
                            "model": getattr(settings, "OPENAI_MODEL", "gpt-4o-mini"),
                            "tokens_estimate": est_tokens,
                        },
                    )
                    start = time.perf_counter()
                    llm_val = llm_complete(prompt, data)
                    latency = int((time.perf_counter() - start) * 1000)
                    if llm_val:
                        logger.info(
                            "llm_success",
                            extra={"form": form_name, "field": k, "latency_ms": latency},
                        )
                        llm_val = " ".join(llm_val.strip().split())
                        _, value = normalize_text_field(k, llm_val)
                        if isinstance(value, str) and k == "entity_type":
                            value = _canonical_entity_type(value)
                        if reasoning is not None:
                            reasoning.append(f"{k} inferred by LLM")
                    else:
                        logger.info(
                            "llm_fallback",
                            extra={"form": form_name, "field": k, "reason": "empty"},
                        )
            if not value:
                value = _generate_text(data, example)
                if reasoning is not None:
                    reasoning.append(f"{k} generated from template")
        elif ftype == "dropdown" and not value:
            value = _generate_text(data, example if prompt is not None else None)
            if reasoning is not None:
                reasoning.append(f"{k} inferred choice")
        elif ftype == "checkbox":
            value = bool(value)
        elif ftype == "date" and not value:
            value = datetime.utcnow().strftime("%Y-%m-%d")
            if reasoning is not None:
                reasoning.append(f"{k} defaulted to today")
        elif ftype == "file_upload" and not value:
            guess = guess_attachment(expected_file or k)
            if guess:
                attachments[k] = guess
                value = guess.split("/")[-1]
                if reasoning is not None:
                    reasoning.append(f"{k} auto-attached")

        merged[k] = value
        if k not in sources:
            if k in data:
                sources[k] = "user"
            elif prompt:
                sources[k] = "generated"
            elif ftype == "file_upload" and k in attachments:
                sources[k] = "file"
            else:
                sources[k] = "inferred"
    for k in conditional.keys():
        if k in data:
            merged[k] = data[k]

    template["fields"] = merged
    if attachments:
        template.setdefault("files", {}).update(attachments)

    for section in template.get("sections", []):
        child = _fill_template(section, data, reasoning, form_name=form_name)
        if child.get("files"):
            template.setdefault("files", {}).update(child["files"])

    if sources:
        template["sources"] = sources

    return template


def fill_form(
    form_key: str,
    data: Dict[str, Any],
    analyzer_fields: Optional[Dict[str, Any]] = None,
    file_bytes: bytes | None = None,
) -> Dict[str, Any]:
    """Load ``form_key`` template and merge ``data`` into the fields."""
    if analyzer_fields:
        filled_keys: list[str] = []
        for k, v in analyzer_fields.items():
            if k not in data or data[k] in (None, ""):
                data[k] = v
                filled_keys.append(k)
        if filled_keys:
            logger.debug("analyzer_backfill", extra={"keys": filled_keys})
    if file_bytes:
        data.update(extract_fields(file_bytes))
    # flatten deeply nested sections for easier access
    data = _flatten_stats_fields(data)
    # derive common checkboxes from known canonical fields
    et = data.get("entity_type")
    if isinstance(et, str):
        canon = _canonical_entity_type(et)
        data["entity_type"] = canon
        if canon:
            data["corporate"] = canon not in ["Sole Proprietor"]
            data["individual"] = not data["corporate"]
    atype = str(data.get("assistance_type", "")).lower()
    data["loan"] = atype == "loan"
    data["grant"] = atype == "grant"
    data["loan_guaranty"] = atype in {"loan_guaranty", "loan guaranty"}
    data["other_assistance"] = atype == "other"
    source = str(data.get("source_of_funds", "")).lower()
    data["source_of_funds_direct"] = source == "direct"
    data["source_of_funds_insured"] = source == "insured"
    assistance = data.get("type_of_assistance")
    if isinstance(assistance, list):
        for opt in assistance:
            key = "type_of_assistance_" + opt.lower().replace("&", "and").replace(" ", "_")
            data[key] = True
    elif isinstance(assistance, str):
        key = "type_of_assistance_" + assistance.lower().replace("&", "and").replace(" ", "_")
        data[key] = True
    submission = str(data.get("type_of_submission", "")).lower()
    data["type_of_submission_application"] = submission == "application"
    data["type_of_submission_preapplication"] = submission == "preapplication"
    code = str(data.get("type_of_applicant_code", "")).upper()
    for letter in "ABCDEFGHIJKLMN":
        data[f"type_of_applicant_code_{letter}"] = code == letter
    path = FORM_DIR / f"{form_key}.json"
    with path.open("r", encoding="utf-8") as f:
        template = json.load(f)
    # Some templates wrap the actual form definition under a top-level "form"
    # key.  Normalise to a structure with "fields" at the root so the rest of
    # the logic can operate consistently.
    if "form" in template and "fields" not in template:
        template = template["form"]
    if isinstance(template.get("fields"), list):
        flist = template["fields"]
        converted: Dict[str, Any] = {}
        for item in flist:
            if isinstance(item, dict):
                key = item.get("name") or item.get("key")
                if key:
                    converted[key] = {k: v for k, v in item.items() if k not in {"name", "key"}}
        template["fields"] = converted
    reasoning: list[str] = []
    filled = _fill_template(template, data, reasoning, form_name=form_key)
    if reasoning:
        filled["reasoning_log"] = reasoning
    fields = filled.get("fields", {})
    flat = _flatten_dict(fields)
    stats_fields = {k: v for k, v in data.items() if k.startswith(("a1_", "a2_", "a3_", "b1_"))}
    flat.update(stats_fields)
    for k, v in list(flat.items()):
        if isinstance(v, str):
            nv = v.strip()
            if k.endswith("_zip") or k == "zip":
                nv = _normalize_zip(nv)
            elif k.endswith("_state") or k == "state":
                nv = _normalize_state(nv)
            flat[k] = nv
    # normalise yes/no style fields
    for k in YES_NO_FIELDS:
        if k in flat:
            v = flat[k]
            if isinstance(v, bool):
                flat[k] = "yes" if v else "no"
            elif isinstance(v, str):
                lv = v.strip().lower()
                if lv in {"y", "yes", "true", "1"}:
                    flat[k] = "yes"
                elif lv in {"n", "no", "false", "0"}:
                    flat[k] = "no"
    if (
        flat.get("corporate_recipient_name") in {None, ""}
        and data.get("corporate")
        and flat.get("recipient_name")
    ):
        flat["corporate_recipient_name"] = flat["recipient_name"]
    funding_keys = [k for k in flat if k.startswith("funding_") and k != "funding_total"]
    total = 0.0
    has_val = False
    for k in funding_keys:
        v = flat.get(k)
        if isinstance(v, str):
            v = v.replace("$", "").replace(",", "")
        try:
            num = float(v)
        except (TypeError, ValueError):
            continue
        flat[k] = num
        total += num
        if num:
            has_val = True
    if has_val:
        flat["funding_total"] = total

    if form_key == "form_8974":
        numeric_keys = [
            "line1_amount_form_6765",
            "line1_credit_taken_previous",
            "line1_remaining_credit",
            "line2_amount_form_6765",
            "line2_credit_taken_previous",
            "line2_remaining_credit",
            "line3_amount_form_6765",
            "line3_credit_taken_previous",
            "line3_remaining_credit",
            "line4_amount_form_6765",
            "line4_credit_taken_previous",
            "line4_remaining_credit",
            "line5_amount_form_6765",
            "line5_credit_taken_previous",
            "line5_remaining_credit",
            "line6",
            "line7",
            "line8",
            "line9",
            "line10",
            "line11",
            "line12",
            "line13",
            "line14",
            "line15",
            "line16",
            "line17",
        ]
        for k in numeric_keys:
            if k in flat:
                flat[k] = _to_float(flat[k])
        mismatches: list[str] = []
        line6_calc = sum(flat.get(f"line{i}_remaining_credit", 0.0) for i in range(1, 6))
        if "line6" in flat and round(flat.get("line6", 0.0), 2) != round(line6_calc, 2):
            mismatches.append("line6")
        flat["line6"] = round(line6_calc, 2)
        line10_calc = flat.get("line8", 0.0) + flat.get("line9", 0.0)
        if "line10" in flat and round(flat.get("line10", 0.0), 2) != round(line10_calc, 2):
            mismatches.append("line10")
        flat["line10"] = round(line10_calc, 2)
        line11_calc = line10_calc * 0.5
        if "line11" in flat and round(flat.get("line11", 0.0), 2) != round(line11_calc, 2):
            mismatches.append("line11")
        flat["line11"] = round(line11_calc, 2)
        line12_calc = min(flat.get("line7", 0.0), flat["line11"], 250000.0)
        if "line12" in flat and round(flat.get("line12", 0.0), 2) != round(line12_calc, 2):
            mismatches.append("line12")
        flat["line12"] = round(line12_calc, 2)
        line13_calc = flat.get("line7", 0.0) - flat["line12"]
        if "line13" in flat and round(flat.get("line13", 0.0), 2) != round(line13_calc, 2):
            mismatches.append("line13")
        flat["line13"] = round(line13_calc, 2)
        line15_calc = flat.get("line14", 0.0) * 0.5
        if "line15" in flat and round(flat.get("line15", 0.0), 2) != round(line15_calc, 2):
            mismatches.append("line15")
        flat["line15"] = round(line15_calc, 2)
        line16_calc = min(flat["line13"], flat["line15"])
        if "line16" in flat and round(flat.get("line16", 0.0), 2) != round(line16_calc, 2):
            mismatches.append("line16")
        flat["line16"] = round(line16_calc, 2)
        line17_calc = flat["line12"] + flat["line16"]
        if "line17" in flat and round(flat.get("line17", 0.0), 2) != round(line17_calc, 2):
            mismatches.append("line17")
        flat["line17"] = round(line17_calc, 2)
        if mismatches:
            logger.error("form_fill_calculation_mismatch", extra={"form": form_key, "fields": mismatches})

    elif form_key == "form_6765":
        for k, v in list(flat.items()):
            if k.startswith("line_") and k.endswith("_value"):
                flat[k] = _to_float(v)
            elif k.endswith("_pct"):
                pct = _to_float(str(v).replace("%", ""))
                if pct > 1:
                    pct /= 100.0
                flat[k] = pct
        bool_keys = [
            "question_a_elect_reduced_credit",
            "question_b_under_common_control",
            "line_33a_checked",
            "line_33b_checked",
            "line_39_value",
            "line_40_value",
            "line_41_value",
        ]
        for bk in bool_keys:
            if bk in flat:
                flat[bk] = bool(flat[bk])
        if flat.get("question_b_under_common_control"):
            flat["attachment_required_common_control"] = True
        mismatches: list[str] = []
        line4 = max(flat.get("line_2_value", 0.0) - flat.get("line_3_value", 0.0), 0.0)
        if "line_4_value" in flat and round(flat.get("line_4_value", 0.0), 2) != round(line4, 2):
            mismatches.append("line_4_value")
        flat["line_4_value"] = round(line4, 2)
        line8 = flat.get("line_7_value", 0.0) * flat.get("line_6_pct", 0.0)
        if "line_8_value" in flat and round(flat.get("line_8_value", 0.0), 2) != round(line8, 2):
            mismatches.append("line_8_value")
        flat["line_8_value"] = round(line8, 2)
        line9 = max(flat.get("line_5_value", 0.0) - flat["line_8_value"], 0.0)
        if "line_9_value" in flat and round(flat.get("line_9_value", 0.0), 2) != round(line9, 2):
            mismatches.append("line_9_value")
        flat["line_9_value"] = round(line9, 2)
        line10 = flat.get("line_5_value", 0.0) * 0.5
        if "line_10_value" in flat and round(flat.get("line_10_value", 0.0), 2) != round(line10, 2):
            mismatches.append("line_10_value")
        flat["line_10_value"] = round(line10, 2)
        line11 = min(flat["line_9_value"], line10)
        if "line_11_value" in flat and round(flat.get("line_11_value", 0.0), 2) != round(line11, 2):
            mismatches.append("line_11_value")
        flat["line_11_value"] = round(line11, 2)
        line12 = (
            flat.get("line_1_value", 0.0) + flat["line_4_value"] + flat["line_11_value"]
        )
        if "line_12_value" in flat and round(flat.get("line_12_value", 0.0), 2) != round(line12, 2):
            mismatches.append("line_12_value")
        flat["line_12_value"] = round(line12, 2)
        if flat.get("question_a_elect_reduced_credit"):
            line13 = line12 * 0.158
        else:
            line13 = line12 * 0.20
        if "line_13_value" in flat and round(flat.get("line_13_value", 0.0), 2) != round(line13, 2):
            mismatches.append("line_13_value")
        flat["line_13_value"] = round(line13, 2)
        line17 = max(flat.get("line_15_value", 0.0) - flat.get("line_16_value", 0.0), 0.0)
        if "line_17_value" in flat and round(flat.get("line_17_value", 0.0), 2) != round(line17, 2):
            mismatches.append("line_17_value")
        flat["line_17_value"] = round(line17, 2)
        line18 = flat.get("line_14_value", 0.0) + line17
        if "line_18_value" in flat and round(flat.get("line_18_value", 0.0), 2) != round(line18, 2):
            mismatches.append("line_18_value")
        flat["line_18_value"] = round(line18, 2)
        line19 = line18 * 0.20
        if "line_19_value" in flat and round(flat.get("line_19_value", 0.0), 2) != round(line19, 2):
            mismatches.append("line_19_value")
        flat["line_19_value"] = round(line19, 2)
        line22 = flat.get("line_21_value", 0.0) / 6.0 if flat.get("line_21_value") else 0.0
        flat["line_22_value"] = round(line22, 2)
        if flat.get("line_21_value"):
            line23 = max(flat.get("line_20_value", 0.0) - line22, 0.0)
            if "line_23_value" in flat and round(flat.get("line_23_value", 0.0), 2) != round(line23, 2):
                mismatches.append("line_23_value")
            line24 = line23 * 0.14
            flat["line_23_value"] = round(line23, 2)
        else:
            line23 = 0.0
            flat["line_23_value"] = 0.0
            line24 = flat.get("line_20_value", 0.0) * 0.06
        if "line_24_value" in flat and round(flat.get("line_24_value", 0.0), 2) != round(line24, 2):
            mismatches.append("line_24_value")
        flat["line_24_value"] = round(line24, 2)
        line25 = line19 + line24
        if "line_25_value" in flat and round(flat.get("line_25_value", 0.0), 2) != round(line25, 2):
            mismatches.append("line_25_value")
        flat["line_25_value"] = round(line25, 2)
        if flat.get("question_a_elect_reduced_credit"):
            line26 = line25 * 0.79
        else:
            line26 = line25
        if "line_26_value" in flat and round(flat.get("line_26_value", 0.0), 2) != round(line26, 2):
            mismatches.append("line_26_value")
        flat["line_26_value"] = round(line26, 2)
        base = flat.get("line_13_value", 0.0) or flat.get("line_26_value", 0.0)
        source = "A" if flat.get("line_13_value", 0.0) else "B"
        line28 = max(base - flat.get("line_27_value", 0.0), 0.0)
        if "line_28_value" in flat and round(flat.get("line_28_value", 0.0), 2) != round(line28, 2):
            mismatches.append("line_28_value")
        flat["line_28_value"] = round(line28, 2)
        flat["line_28_source"] = source
        line30 = line28 + flat.get("line_29_value", 0.0)
        if "line_30_value" in flat and round(flat.get("line_30_value", 0.0), 2) != round(line30, 2):
            mismatches.append("line_30_value")
        flat["line_30_value"] = round(line30, 2)
        if flat.get("line_31_value"):
            line32 = line30 - flat.get("line_31_value", 0.0)
        else:
            line32 = line30
        if "line_32_value" in flat and round(flat.get("line_32_value", 0.0), 2) != round(line32, 2):
            mismatches.append("line_32_value")
        flat["line_32_value"] = round(line32, 2)
        if flat.get("line_33a_checked"):
            line34 = min(flat.get("line_34_value", 0.0), 500000.0)
            flat["line_34_value"] = round(line34, 2)
            if flat.get("entity_type") in {"Partnership", "S-Corp"} or flat.get("line_35_value") in (None, "", 0):
                line36 = min(line28, line34)
            else:
                line36 = min(line28, line34, flat.get("line_35_value", 0.0))
            if "line_36_value" in flat and round(flat.get("line_36_value", 0.0), 2) != round(line36, 2):
                mismatches.append("line_36_value")
            flat["line_36_value"] = round(line36, 2)
            flat["line1_amount_form_6765"] = flat["line_36_value"]
        line47 = flat.get("line_45_value", 0.0) + flat.get("line_46_value", 0.0)
        if "line_47_value" in flat and round(flat.get("line_47_value", 0.0), 2) != round(line47, 2):
            mismatches.append("line_47_value")
        flat["line_47_value"] = round(line47, 2)
        line48 = (
            flat.get("line_42_value", 0.0)
            + flat.get("line_43_value", 0.0)
            + flat.get("line_44_value", 0.0)
            + line47
        )
        if "line_48_value" in flat and round(flat.get("line_48_value", 0.0), 2) != round(line48, 2):
            mismatches.append("line_48_value")
        flat["line_48_value"] = round(line48, 2)
        required = ["names_shown_on_return", "identifying_number"]
        section_a = any(flat.get(k) not in (None, "") for k in ["line_5_value", "line_6_pct", "line_7_value"])
        if section_a:
            required.extend(["line_5_value", "line_6_pct", "line_7_value"])
        else:
            if flat.get("line_20_value") not in (None, ""):
                required.append("line_20_value")
                if flat.get("line_21_value"):
                    required.append("line_21_value")
        if flat.get("line_33a_checked"):
            required.append("line_34_value")
        missing_keys = [k for k in required if flat.get(k) in (None, "")]
        filled["required_ok"] = not missing_keys
        filled["missing_keys"] = missing_keys
        filled["calc_mismatches"] = mismatches

    if getattr(settings, "OPENAI_API_KEY", None):
        if "business_summary" not in flat:
            prompt = "Provide a brief business summary based on available information."
            logger.info(
                "llm_invocation",
                extra={
                    "form": form_key,
                    "field": "business_summary",
                    "model": getattr(settings, "OPENAI_MODEL", None),
                    "tokens_estimate": (len(prompt) + len(json.dumps(flat))) // 4,
                },
            )
            summary = llm_complete(prompt, flat)
            if summary:
                logger.info(
                    "llm_success",
                    extra={"form": form_key, "field": "business_summary", "latency_ms": 0},
                )
                flat["business_summary"] = " ".join(summary.strip().split())
            else:
                logger.info(
                    "llm_fallback",
                    extra={"form": form_key, "field": "business_summary", "reason": "empty"},
                )
                flat["business_summary"] = "summary unavailable"
        if "entity_type" not in flat:
            prompt = "What is the entity type of the business?"
            logger.info(
                "llm_invocation",
                extra={
                    "form": form_key,
                    "field": "entity_type",
                    "model": getattr(settings, "OPENAI_MODEL", None),
                    "tokens_estimate": (len(prompt) + len(json.dumps(flat))) // 4,
                },
            )
            ent = llm_complete(prompt, flat)
            if ent:
                logger.info(
                    "llm_success",
                    extra={"form": form_key, "field": "entity_type", "latency_ms": 0},
                )
                flat["entity_type"] = _canonical_entity_type(ent)
            else:
                logger.info(
                    "llm_fallback",
                    extra={"form": form_key, "field": "entity_type", "reason": "empty"},
                )
    filled["fields"] = flat
    return filled
