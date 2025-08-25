from pathlib import Path
import json
from typing import List, Dict, Any

from fastapi import FastAPI

from common.logger import get_logger

from grants_loader import load_grants
from rules_utils import check_rules, check_rule_groups, estimate_award

app = FastAPI()

logger = get_logger(__name__)


@app.get("/healthz")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


def _heuristic_estimate(data: Dict[str, Any]) -> int:
    """Fallback estimation using simple heuristics."""
    payroll = data.get("annual_payroll") or data.get("payroll")
    if payroll:
        try:
            return max(int(payroll) // 10, 1000)
        except (TypeError, ValueError):
            pass
    revenue = data.get("annual_revenue")
    drop = data.get("revenue_drop_percent")
    if revenue and drop:
        try:
            return max(int(revenue) * int(drop) // 100, 1000)
        except (TypeError, ValueError):
            pass
    return 5000


def analyze_eligibility(
    user_data: Dict[str, Any], explain: bool = False
) -> List[Dict[str, Any]]:
    """Validate user data against all grant definitions."""
    grants = load_grants()
    user_tags = set(user_data.get("tags", []))

    results: List[Dict[str, Any]] = []
    for grant in grants:
        logger.debug("Evaluating grant %s", grant.get("name"))
        grant_tags = set(grant.get("tags", []))
        tag_score = {tag: 1 for tag in user_tags & grant_tags} if user_tags else {}
        missing = [f for f in grant.get("required_fields", []) if f not in user_data]
        if missing:
            logger.debug("%s missing fields: %s", grant.get("name"), missing)
            continue

        if grant.get("eligibility_categories"):
            rule_result = check_rule_groups(user_data, grant.get("eligibility_categories"))
            if rule_result.get("estimated_award"):
                award_info = rule_result.get("estimated_award")
            elif rule_result["eligible"]:
                award_info = estimate_award(user_data, grant.get("estimated_award", {}))
            else:
                award_info = 0
            required_forms = grant.get("requiredForms", []) + rule_result.get("required_forms", [])
        else:
            rule_result = check_rules(user_data, grant.get("eligibility_rules", {}))
            award_info = (
                estimate_award(user_data, grant.get("estimated_award", {}))
                if rule_result["eligible"]
                else 0
            )
            required_forms = grant.get("requiredForms", [])

        if rule_result.get("status") == "ineligible":
            continue

        if isinstance(award_info, dict):
            amount = award_info.get("amount", 0)
        else:
            amount = award_info
        if rule_result.get("status") == "conditional" and amount == 0:
            amount = _heuristic_estimate(user_data)

        debug_data = {**rule_result["debug"]}
        debug_data["award"] = award_info if isinstance(award_info, dict) else {"amount": amount}
        if rule_result.get("selected_group"):
            debug_data["selected_group"] = rule_result.get("selected_group")

        reasoning = list(rule_result["reasoning"])
        if rule_result.get("status") == "conditional":
            missing_fields = rule_result["debug"].get("missing_fields", [])
            reasoning.append(
                f"Conditional result: missing fields {missing_fields} prevent full validation"
            )
        else:
            missing_fields = []

        result = {
            "name": grant.get("name"),
            "eligible": rule_result["eligible"],
            "score": rule_result["score"],
            "certainty_level": rule_result.get("certainty"),
            "estimated_amount": amount,
            "reasoning": reasoning,
            "debug": debug_data,
            "missing_fields": missing_fields,
            "tag_score": tag_score,
            "reasoning_steps": [],
            "llm_summary": "",
            "next_steps": "" if rule_result.get("status") == "eligible" else "Review eligibility criteria",
        }
        if required_forms:
            result["requiredForms"] = required_forms
        logger.debug(
            "Grant %s result: eligible=%s score=%s",
            grant.get("name"),
            result["eligible"],
            result["score"],
        )
        results.append(result)

    if not results or all(r.get("estimated_amount", 0) <= 0 for r in results):
        amount = _heuristic_estimate(user_data)
        results.append(
            {
                "name": "General Support Grant",
                "eligible": None,
                "score": 0,
                "certainty_level": "low",
                "estimated_amount": amount,
                "reasoning": [
                    "Fallback grant offered based on partial information",
                ],
                "missing_fields": [],
                "next_steps": "Provide additional information to match specific grants",
                "requiredForms": ["form_sf424"],
                "tag_score": {},
                "reasoning_steps": [],
                "llm_summary": "",
                "debug": {"fallback": True},
            }
        )

    if user_tags:
        results.sort(key=lambda r: r.get("score", 0), reverse=True)

    return results


if __name__ == "__main__":
    sample_file = Path(__file__).parent / "test_payload.json"
    if sample_file.exists():
        with sample_file.open("r", encoding="utf-8") as f:
            payload = json.load(f)
    else:
        payload = {}
    for result in analyze_eligibility(payload, explain=True):
        logger.debug("sample_result", extra={"fields": list(result.keys())})
