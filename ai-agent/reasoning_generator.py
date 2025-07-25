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


def generate_llm_summary(results: List[Dict[str, Any]], user_data: Dict[str, Any]) -> str:
    """Return a human readable summary of the overall eligibility."""
    if not results:
        return "No grants were evaluated."

    passed = [r for r in results if r.get("eligible")]
    if passed:
        top = passed[0]
        return (
            f"You appear eligible for {top['name']} with an estimated award of ${top.get('estimated_amount',0)}."
        )

    top = max(results, key=lambda r: r.get("score", 0))
    return (
        f"No full eligibility found. Highest score is {top.get('score',0)}% for {top['name']}."
    )


def generate_clarifying_questions(results: List[Dict[str, Any]]) -> List[str]:
    """Create follow-up questions based on missing fields."""
    missing: set[str] = set()
    for res in results:
        missing.update(res.get("debug", {}).get("missing_fields", []))
    return [f"Please provide your {field}" for field in sorted(missing)]
