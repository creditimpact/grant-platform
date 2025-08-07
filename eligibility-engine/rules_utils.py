"""Utility helpers to evaluate eligibility rules and estimate award amounts."""

from typing import Any, Dict, List
import logging


logger = logging.getLogger(__name__)


def _normalize_numeric(value: Any) -> Any:
    """Attempt to convert numeric strings to ints for comparisons."""
    if isinstance(value, str):
        try:
            if "." in value:
                return float(value)
            return int(value)
        except ValueError:
            return value
    return value


def _evaluate_rule(data: Dict[str, Any], key: str, rule_val: Any):
    """Evaluate a single rule and return status, message and debug info."""
    logger.debug("Evaluating rule %s with value %s", key, rule_val)
    base_key = key
    expectation = None
    actual = None
    if key.endswith("_each_min"):
        base_key = key[:-9]
        expectation = f"each >= {rule_val}"
        actual = data.get(base_key)
        if actual is None:
            return None, f"❌ {base_key} missing", actual, expectation
        if not isinstance(actual, list):
            return False, f"❌ {base_key} not a list", actual, expectation
        passed = all(val >= rule_val for val in actual)
        return passed, (
            f"{'✅' if passed else '❌'} {base_key} = {actual}, expected each >= {rule_val}"
        ), actual, expectation

    if key.endswith("_each_max"):
        base_key = key[:-9]
        expectation = f"each <= {rule_val}"
        actual = data.get(base_key)
        if actual is None:
            return None, f"❌ {base_key} missing", actual, expectation
        if not isinstance(actual, list):
            return False, f"❌ {base_key} not a list", actual, expectation
        passed = all(val <= rule_val for val in actual)
        return passed, (
            f"{'✅' if passed else '❌'} {base_key} = {actual}, expected each <= {rule_val}"
        ), actual, expectation

    if key.endswith("_min"):
        base_key = key[:-4]
        expectation = f">= {rule_val}"
        actual = _normalize_numeric(data.get(base_key))
        if actual is None:
            return None, f"❌ {base_key} missing", actual, expectation
        return actual >= rule_val, (
            f"{'✅' if actual >= rule_val else '❌'} {base_key} = {actual}, expected >= {rule_val}"
        ), actual, expectation

    if key.endswith("_max"):
        base_key = key[:-4]
        expectation = f"<= {rule_val}"
        actual = _normalize_numeric(data.get(base_key))
        if actual is None:
            return None, f"❌ {base_key} missing", actual, expectation
        return actual <= rule_val, (
            f"{'✅' if actual <= rule_val else '❌'} {base_key} = {actual}, expected <= {rule_val}"
        ), actual, expectation

    if key.endswith("_between"):
        base_key = key[:-8]
        min_val, max_val = rule_val
        expectation = f"between {min_val} and {max_val}"
        actual = _normalize_numeric(data.get(base_key))
        if actual is None:
            return None, f"❌ {base_key} missing", actual, expectation
        passed = min_val <= actual <= max_val
        return passed, (
            f"{'✅' if passed else '❌'} {base_key} = {actual}, expected between {min_val}-{max_val}"
        ), actual, expectation

    if key == "any_true":
        expectation = f"any of {rule_val} true"
        actual = {k: data.get(k) for k in rule_val}
        missing = [k for k, v in actual.items() if v is None]
        if missing:
            return None, f"❌ {', '.join(missing)} missing", actual, expectation
        passed = any(actual.values())
        return passed, (
            f"{'✅' if passed else '❌'} any_true {actual}"
        ), actual, expectation

    if isinstance(rule_val, list):
        expectation = f"in {rule_val}"
        actual = _normalize_numeric(data.get(key))
        if actual is None:
            return None, f"❌ {key} missing", actual, expectation
        passed = actual in rule_val
        return passed, (
            f"{'✅' if passed else '❌'} {key} = {actual}, expected one of {rule_val}"
        ), actual, expectation

    if isinstance(rule_val, dict):
        actual = _normalize_numeric(data.get(key))
        if actual is None:
            expectation_parts = []
            if "min" in rule_val:
                expectation_parts.append(f">= {rule_val['min']}")
            if "max" in rule_val:
                expectation_parts.append(f"<= {rule_val['max']}")
            if "one_of" in rule_val or "allowed" in rule_val:
                allowed = rule_val.get("one_of") or rule_val.get("allowed")
                expectation_parts.append(f"in {allowed}")
            if "min_field" in rule_val:
                expectation_parts.append(
                    f">= {rule_val['min_field']} + {rule_val.get('offset', 0)}"
                )
            if "max_field" in rule_val:
                expectation_parts.append(
                    f"<= {rule_val['max_field']} + {rule_val.get('offset', 0)}"
                )
            expectation = " and ".join(expectation_parts)
            return None, f"❌ {key} missing", actual, expectation

        passed = True
        expectation_parts = []
        if "min" in rule_val:
            expectation_parts.append(f">= {rule_val['min']}")
            ok = actual >= rule_val["min"]
            passed = passed and ok
        if "max" in rule_val:
            expectation_parts.append(f"<= {rule_val['max']}")
            ok = actual <= rule_val["max"]
            passed = passed and ok
        if "min_field" in rule_val:
            other = _normalize_numeric(data.get(rule_val["min_field"]))
            offset = rule_val.get("offset", 0)
            expectation_parts.append(
                f">= {rule_val['min_field']} + {offset}"
            )
            if other is None:
                return None, f"❌ {rule_val['min_field']} missing", actual, \
                    f">= {rule_val['min_field']} + {offset}"
            ok = actual >= other + offset
            passed = passed and ok
        if "max_field" in rule_val:
            other = _normalize_numeric(data.get(rule_val["max_field"]))
            offset = rule_val.get("offset", 0)
            expectation_parts.append(
                f"<= {rule_val['max_field']} + {offset}"
            )
            if other is None:
                return None, f"❌ {rule_val['max_field']} missing", actual, \
                    f"<= {rule_val['max_field']} + {offset}"
            ok = actual <= other + offset
            passed = passed and ok
        if "one_of" in rule_val or "allowed" in rule_val:
            allowed = rule_val.get("one_of") or rule_val.get("allowed")
            expectation_parts.append(f"in {allowed}")
            ok = actual in allowed
            passed = passed and ok
        expectation = " and ".join(expectation_parts)
        return passed, (
            f"{'✅' if passed else '❌'} {key} = {actual}, expected {expectation}"
        ), actual, expectation

    # simple equality
    expectation = str(rule_val)
    actual = _normalize_numeric(data.get(key))
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
        logger.debug("%s -> %s", key, msg)
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


def check_rule_groups(data: Dict[str, Any], groups: Dict[str, Dict[str, Any]]):
    """Evaluate multiple rule groups (e.g., WOSB, EDWOSB) and aggregate results."""
    mode = groups.get("__mode__", "all")
    grouped = {k: v for k, v in groups.items() if k != "__mode__"}
    aggregated_reasoning: List[str] = []
    aggregated_debug: Dict[str, Any] = {"groups": {}, "missing_fields": []}
    scores: List[int] = []
    eligibility: Any = (False if mode == "any" else True)

    for name, rules in grouped.items():
        logger.debug("Evaluating rule group %s", name)
        result = check_rules(data, rules)
        aggregated_reasoning.extend([f"[{name}] {msg}" for msg in result["reasoning"]])
        aggregated_debug["groups"][name] = result["debug"]
        aggregated_debug["missing_fields"].extend(result["debug"].get("missing_fields", []))

        if mode == "any":
            if result["eligible"]:
                eligibility = True
            elif result["eligible"] is None and eligibility is False:
                eligibility = None
        else:
            if result["eligible"] is False:
                eligibility = False
            elif result["eligible"] is None and eligibility is not False:
                eligibility = None
        scores.append(result["score"])

    score = int(sum(scores) / len(scores)) if scores else 0
    return {
        "eligible": eligibility,
        "score": score,
        "reasoning": aggregated_reasoning,
        "debug": aggregated_debug,
    }


def estimate_award(data: Dict[str, Any], rule: Dict[str, Any]):
    """Estimate the award based on the rule definition."""
    if not rule:
        return 0

    rtype = rule.get("type", "base")

    if rtype == "percentage":
        base_field = rule.get("based_on") or rule.get("base_amount_field") or ""
        base = data.get(base_field, 0)
        percent = rule.get("percent")
        if percent is None:
            percent = rule.get("percentage", 0)
            if percent <= 1:
                percent *= 100
        amount = base * (percent / 100)
        max_cap = rule.get("max") or rule.get("cap")
        if max_cap is not None:
            amount = min(amount, max_cap)
        return int(amount)

    if rtype == "population_subsidy":
        base_field = rule.get("base_amount_field", "project_cost")
        pop_field = rule.get("population_field", "service_area_population")
        income_field = rule.get("income_field", "income_level")
        project_type_field = rule.get("project_type_field", "project_type")
        base = _normalize_numeric(data.get(base_field, 0))
        population = _normalize_numeric(data.get(pop_field, 0))
        income = data.get(income_field)
        percent = rule.get("default_percent", 0)
        for tier in rule.get("tiers", []):
            max_pop = tier.get("max_population")
            income_req = tier.get("income_level")
            if max_pop is not None and population > max_pop:
                continue
            if income_req and income != income_req:
                continue
            percent = tier.get("percent", percent)
            break
        amount = base * (percent / 100)
        caps = rule.get("caps", {})
        proj_type = data.get(project_type_field)
        if proj_type in caps:
            amount = min(amount, caps[proj_type])
        return int(amount)

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

    if rtype == "payroll_credit":
        credit_field = rule.get("credit_field", "rd_credit_amount")
        payroll_field = rule.get("payroll_tax_field", "payroll_tax_liability")
        carry_field = rule.get("carryforward_field", "carryforward_credit")
        annual_cap = rule.get("annual_cap", 0)
        requested = _normalize_numeric(data.get(credit_field, 0))
        payroll = _normalize_numeric(data.get(payroll_field, 0))
        carry = _normalize_numeric(data.get(carry_field, 0))
        available = requested + carry
        if annual_cap:
            available = min(available, annual_cap)
        amount = min(available, payroll)
        remaining = available - amount
        return {"amount": int(amount), "carryforward": int(remaining)}

    # default to base amount
    return int(rule.get("base", 0))
