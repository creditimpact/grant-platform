import pytest

from form_filler import safe_eval, _fill_template

def test_safe_eval_basic():
    ctx = {"a": 2, "b": 3, "flag": False}
    assert safe_eval("a + b * 2", ctx) == 8
    assert safe_eval("not flag and a < 5", ctx) is True


def test_safe_eval_rejects_malicious():
    with pytest.raises(ValueError):
        safe_eval("__import__('os').system('ls')", {})


def test_safe_eval_rejects_bad_names():
    with pytest.raises(ValueError):
        safe_eval("x", {"bad__name": 1})


def test_safe_eval_rejects_callables_in_context():
    with pytest.raises(ValueError):
        safe_eval("x", {"f": lambda: 1})


def test_safe_eval_rejects_too_complex():
    expr = " + ".join(["1"] * 60)
    with pytest.raises(ValueError):
        safe_eval(expr, {})


def test_safe_eval_rejects_large_literals():
    long_str = "a" * 1001
    with pytest.raises(ValueError):
        safe_eval(f"'{long_str}'", {})
    with pytest.raises(ValueError):
        safe_eval(str(10**10), {})


def test_computed_field_uses_safe_eval():
    template = {
        "fields": {"a": "", "b": "", "sum": ""},
        "computed_fields": {"sum": "a + b"},
    }
    data = {"a": 1, "b": 2}
    result = _fill_template(template, data)
    assert result["fields"]["sum"] == 3


def test_computed_field_rejects_malicious():
    template = {
        "fields": {"bad": {"example": "placeholder"}},
        "computed_fields": {"bad": "__import__('os').system('ls')"},
    }
    result = _fill_template(template, {})
    assert result["fields"]["bad"] == "placeholder"
