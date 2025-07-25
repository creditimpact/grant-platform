"""Utility helpers to evaluate eligibility rules and estimate award amounts."""

from typing import Any, Dict, List


def _evaluate_rule(data: Dict[str, Any], key: str, rule_val: Any):
    """Evaluate a single rule and return status, message and debug info."""
    base_key = key
    expectation = None
    actual = None
    if key.endswith("_min"):
        base_key = key[:-4]
        expectation = f">= {rule_val}"
        actual = data.get(base_key)
        if actual is None:
            return None, f"❌ {base_key} missing", actual, expectation
        return actual >= rule_val, (
            f"{'✅' if actual >= rule_val else '❌'} {base_key} = {actual}, expected >= {rule_val}"
        ), actual, expectation

    if key.endswith("_max"):
        base_key = key[:-4]
        expectation = f"<= {rule_val}"
        actual = data.get(base_key)
        if actual is None:
            return None, f"❌ {base_key} missing", actual, expectation
        return actual <= rule_val, (
            f"{'✅' if actual <= rule_val else '❌'} {base_key} = {actual}, expected <= {rule_val}"
        ), actual, expectation

    if isinstance(rule_val, list):
        expectation = f"in {rule_val}"
        actual = data.get(key)
        if actual is None:
            return None, f"❌ {key} missing", actual, expectation
        passed = actual in rule_val
        return passed, (
            f"{'✅' if passed else '❌'} {key} = {actual}, expected one of {rule_val}"
        ), actual, expectation

    if isinstance(rule_val, dict):
        actual = data.get(key)
        if actual is None:
            expectation_parts = []
            if "min" in rule_val:
                expectation_parts.append(f">= {rule_val['min']}")
            if "max" in rule_val:
                expectation_parts.append(f"<= {rule_val['max']}")
            if "one_of" in rule_val:
                expectation_parts.append(f"in {rule_val['one_of']}")
            expectation = " and ".join(expectation_parts)
            return None, f"❌ {key} missing", actual, expectation

        passed = True
        msgs: List[str] = []
        expectation_parts = []
        if "min" in rule_val:
            expectation_parts.append(f">= {rule_val['min']}")
            ok = actual >= rule_val["min"]
            passed = passed and ok
        if "max" in rule_val:
            expectation_parts.append(f"<= {rule_val['max']}")
            ok = actual <= rule_val["max"]
            passed = passed and ok
        if "one_of" in rule_val:
            expectation_parts.append(f"in {rule_val['one_of']}")
            ok = actual in rule_val["one_of"]
            passed = passed and ok
        expectation = " and ".join(expectation_parts)
        return passed, (
            f"{'✅' if passed else '❌'} {key} = {actual}, expected {expectation}"
        ), actual, expectation

    # simple equality
    expectation = str(rule_val)
    actual = data.get(key)
    if actual is None:
        return None, f"❌ {key} missing", actual, expectation
    passed = actual == rule_val
    return passed, (
        f"{'✅' if passed else '❌'} {key} = {actual}, expected {rule_val}"
    ), actual, expectation


def check_rules(data: Dict[str, Any], rules: Dict[str, Any]):
    """Return detailed eligibility results for a set of rules."""
    reasoning: List[str] = []
    debug = {"checked_rules": {}, "missing_fields": []}

    total = len(rules)
    passed_count = 0

    for key, rule_val in rules.items():
        status, msg, actual, expectation = _evaluate_rule(data, key, rule_val)
        reasoning.append(msg)
        debug["checked_rules"][key] = {"value": actual, "expected": expectation}
        if status is None:
            debug["missing_fields"].append(key if not key.endswith(("_min", "_max")) else key[:-4])
        elif status:
            passed_count += 1

    if debug["missing_fields"]:
        return {
            "eligible": None,
            "score": 0,
            "reasoning": reasoning,
            "debug": debug,
        }

    score = int((passed_count / total) * 100) if total else 100
    eligible = passed_count == total
    return {
        "eligible": eligible,
        "score": score,
        "reasoning": reasoning,
        "debug": debug,
    }


def estimate_award(data: Dict[str, Any], rule: Dict[str, Any]) -> int:
    """Estimate the award based on the rule definition."""
    if not rule:
        return 0

    rtype = rule.get("type", "base")

    if rtype == "percentage":
        base = data.get(rule.get("based_on", ""), 0)
        return int(base * (rule.get("percent", 0) / 100))

    if rtype == "flat_per_unit":
        units = data.get(rule.get("per", ""), 0)
        return int(units * rule.get("amount", 0))

    if rtype == "tiered":
        base = data.get(rule.get("based_on", ""), 0)
        tiers = rule.get("tiers", [])
        remaining = base
        total = 0
        for tier in tiers:
            rate = tier.get("percent", 0) / 100
            upto = tier.get("upto")
            if upto is None:
                total += remaining * rate
                remaining = 0
                break
            amt = min(remaining, upto)
            total += amt * rate
            remaining -= amt
            if remaining <= 0:
                break
        return int(total)

    # default to base amount
    return int(rule.get("base", 0))
