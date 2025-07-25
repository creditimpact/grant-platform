def check_rules(data, rules):
    for key, val in rules.items():
        if key.endswith("_min"):
            if data.get(key.replace("_min", ""), 0) < val:
                return False, f"{key.replace('_min', '')} is below minimum"
        elif key.endswith("_max"):
            if data.get(key.replace("_max", ""), 0) > val:
                return False, f"{key.replace('_max', '')} is above maximum"
        elif isinstance(val, list):
            if data.get(key) not in val:
                return False, f"{key} not in accepted values"
        elif data.get(key) != val:
            return False, f"{key} mismatch"
    return True, "All rules passed"


def estimate_award(data, rule):
    if rule.get("type") == "percentage":
        return int(data.get(rule.get("based_on", ""), 0) * (rule.get("percent", 0) / 100))
    return rule.get("base", 0)
