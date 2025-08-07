from pathlib import Path
import json
from typing import List, Dict, Any
import logging

from grants_loader import load_grants
from rules_utils import check_rules, check_rule_groups, estimate_award

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


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
        tag_score = len(user_tags & grant_tags) if user_tags else 0
        missing = [f for f in grant.get("required_fields", []) if f not in user_data]
        if missing:
            logger.debug("%s missing fields: %s", grant.get("name"), missing)
            results.append(
                {
                    "name": grant.get("name"),
                    "eligible": None,
                    "score": 0,
                    "estimated_amount": 0,
                    "reasoning": [f"Missing required fields: {missing}"],
                    "debug": {"checked_rules": {}, "missing_fields": missing},
                    "missing_fields": missing,
                    "next_steps": f"Provide: {', '.join(missing)}",
                    "tag_score": tag_score,
                    "reasoning_steps": [],
                    "llm_summary": "",
                }
            )
            continue

        if grant.get("eligibility_categories"):
            rule_result = check_rule_groups(user_data, grant.get("eligibility_categories"))
        else:
            rule_result = check_rules(user_data, grant.get("eligibility_rules", {}))
        award_info = (
            estimate_award(user_data, grant.get("estimated_award", {}))
            if rule_result["eligible"]
            else 0
        )
        if isinstance(award_info, dict):
            amount = award_info.get("amount", 0)
        else:
            amount = award_info
        result = {
            "name": grant.get("name"),
            "eligible": rule_result["eligible"],
            "score": rule_result["score"],
            "estimated_amount": amount,
            "reasoning": rule_result["reasoning"],
            "debug": {**rule_result["debug"], "award": award_info if isinstance(award_info, dict) else {}},
            "missing_fields": rule_result["debug"].get("missing_fields", []),
            "tag_score": tag_score,
            "reasoning_steps": [],
            "llm_summary": "",
            "next_steps": "" if rule_result["eligible"] else "Review eligibility criteria",
        }
        logger.debug("Grant %s result: eligible=%s score=%s", grant.get("name"), result["eligible"], result["score"])
        results.append(result)

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
        print(result)
