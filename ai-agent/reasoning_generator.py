"""Generate human readable reasoning steps for grant results."""
from typing import Dict, Any, List


def generate_reasoning_steps(grant: Dict[str, Any], user_data: Dict[str, Any], result: Dict[str, Any]) -> List[str]:
    steps: List[str] = []
    debug = result.get("debug", {})
    missing = debug.get("missing_fields", [])
    for field in missing:
        steps.append(f"Missing required field: {field}")

    checked = debug.get("checked_rules", {})
    for rule, info in checked.items():
        val = info.get("value")
        expected = info.get("expected")
        if val is None:
            continue
        if isinstance(val, bool) and isinstance(expected, str):
            expected_val = expected.lower() in {"true", "yes"}
            if val != expected_val:
                steps.append(f"{rule}={val} does not match expected {expected}")
        elif str(val) != str(expected).lstrip('= '):
            steps.append(f"{rule}={val} does not meet {expected}")

    if result.get("eligible") is True:
        steps.append("All eligibility criteria satisfied")
    elif not steps:
        steps.append("One or more eligibility criteria not met")
    return steps
