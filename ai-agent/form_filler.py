"""Smarter form filling utilities."""
import ast
import json
from pathlib import Path
from typing import Dict, Any
from datetime import datetime
import operator as op
from document_utils import extract_fields, guess_attachment
from nlp_utils import normalize_text_field, infer_state_from_zip, llm_complete

FORM_DIR = Path(__file__).parent / "form_templates"

ZIP_STATE = {
    "9": "CA",
    "1": "NY",
    "6": "IL",
}


SAFE_FUNCTIONS = {"int": int, "float": float}

MAX_AST_NODES = 100
MAX_STRING_LENGTH = 1000
MAX_NUMBER_ABS = 10**9


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
) -> Dict[str, Any]:
    fields = template.get("fields", {})
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
    for k, spec in fields.items():
        if isinstance(spec, dict):
            default = spec.get("default", "")
            required = spec.get("required", True)
            ftype = spec.get("type", "text")
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
        if k in data:
            if reasoning is not None:
                reasoning.append(f"{k} provided by user")
        if isinstance(value, str):
            _, value = normalize_text_field(k, value)
        if value is None:
            value = optional.get(k, default if not required else "")

        if ftype in {"text", "textarea"} and not value:
            if prompt:
                context = json.dumps(data)
                value = llm_complete(f"{prompt}\nApplicant data: {context}")
                if reasoning is not None:
                    reasoning.append(f"{k} generated by LLM")
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
        child = _fill_template(section, data, reasoning)
        if child.get("files"):
            template.setdefault("files", {}).update(child["files"])

    if sources:
        template["sources"] = sources

    return template


def fill_form(form_key: str, data: Dict[str, Any], file_bytes: bytes | None = None) -> Dict[str, Any]:
    """Load ``form_key`` template and merge ``data`` into the fields."""
    if file_bytes:
        data.update(extract_fields(file_bytes))
    path = FORM_DIR / f"{form_key}.json"
    with path.open("r", encoding="utf-8") as f:
        template = json.load(f)
    reasoning: list[str] = []
    filled = _fill_template(template, data, reasoning)
    if reasoning:
        filled["reasoning_log"] = reasoning
    return filled
