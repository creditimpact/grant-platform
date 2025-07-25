from pathlib import Path
import json
from typing import List, Dict, Any

from grants_loader import load_grants
from rules_utils import check_rules, estimate_award


def analyze_eligibility(user_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Validate user data against all grant definitions."""
    grants = load_grants()
    results: List[Dict[str, Any]] = []
    for grant in grants:
        missing = [f for f in grant.get("required_fields", []) if f not in user_data]
        if missing:
            results.append({
                "name": grant.get("name"),
                "eligible": False,
                "reason": f"Missing: {missing}"
            })
            continue

        passed, reason = check_rules(user_data, grant.get("eligibility_rules", {}))
        if passed:
            amount = estimate_award(user_data, grant.get("estimated_award", {}))
            results.append({
                "name": grant.get("name"),
                "eligible": True,
                "estimated_amount": amount,
                "reason": reason,
            })
        else:
            results.append({
                "name": grant.get("name"),
                "eligible": False,
                "reason": reason,
            })
    return results


if __name__ == "__main__":
    example = {
        "has_product_or_process_dev": True,
        "is_tech_based": True,
        "qre_total": 120000,
        "revenue_drop": 30,
        "government_shutdown": True,
        "qualified_wages": 80000,
        "business_age_years": 3,
        "owner_credit_score": 700,
        "state": "CA",
        "employees": 10,
        "owner_gender": "female",
        "industry": "technology",
        "city": "New York",
        "owner_minority": True,
        "rural_area": False,
    }
    for result in analyze_eligibility(example):
        print(result)
