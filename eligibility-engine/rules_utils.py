"""Utility helpers to evaluate eligibility rules and estimate award amounts."""

from typing import Any, Dict, Tuple, List


def _check_value(data: Dict[str, Any], key: str, rule_val: Any) -> Tuple[bool, str]:
    """Check an individual value rule."""
    if isinstance(rule_val, dict):
        if "min" in rule_val and data.get(key, 0) < rule_val["min"]:
            return False, f"{key} below minimum {rule_val['min']}"
        if "max" in rule_val and data.get(key, 0) > rule_val["max"]:
            return False, f"{key} above maximum {rule_val['max']}"
        if "one_of" in rule_val and data.get(key) not in rule_val["one_of"]:
            return False, f"{key} not in accepted values"
        return True, "ok"

    if key.endswith("_min"):
        base = key.replace("_min", "")
        if data.get(base, 0) < rule_val:
            return False, f"{base} below minimum {rule_val}"
        return True, "ok"
    if key.endswith("_max"):
        base = key.replace("_max", "")
        if data.get(base, 0) > rule_val:
            return False, f"{base} above maximum {rule_val}"
        return True, "ok"

    if isinstance(rule_val, list):
        if data.get(key) not in rule_val:
            return False, f"{key} not in accepted values"
    elif data.get(key) != rule_val:
        return False, f"{key} must be {rule_val}"
    return True, "ok"


def _eval_rules(data: Dict[str, Any], rules: Any) -> Tuple[bool, str]:
    """Recursively evaluate rules supporting AND/OR/IF logic."""
    if not rules:
        return True, "no rules"

    if isinstance(rules, list):
        for sub in rules:
            ok, reason = _eval_rules(data, sub)
            if not ok:
                return False, reason
        return True, "list passed"

    if isinstance(rules, dict):
        if "any_of" in rules:
            reasons: List[str] = []
            for sub in rules["any_of"]:
                ok, reason = _eval_rules(data, sub)
                reasons.append(reason)
                if ok:
                    return True, f"any_of passed: {reason}"
            return False, " or ".join(reasons)

        if "all_of" in rules:
            for sub in rules["all_of"]:
                ok, reason = _eval_rules(data, sub)
                if not ok:
                    return False, reason
            return True, "all_of passed"

        if "if" in rules and "then" in rules:
            cond, _ = _eval_rules(data, rules["if"])
            if cond:
                ok, reason = _eval_rules(data, rules["then"])
                if not ok:
                    return False, f"conditional failed: {reason}"
            return True, "conditional passed"

        for k, v in rules.items():
            ok, reason = _check_value(data, k, v)
            if not ok:
                return False, reason
        return True, "rules passed"

    return True, "unknown rule type"


def check_rules(data: Dict[str, Any], rules: Dict[str, Any]) -> Tuple[bool, str]:
    """Public wrapper returning whether data satisfies the given rules."""
    return _eval_rules(data, rules)


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
