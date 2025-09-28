from typing import Any, Dict, List

from fastapi import FastAPI

from common.logger import get_logger

from grants_loader import load_grants
from industry_classifier import list_naics_codes
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
        missing_fields = list(rule_result["debug"].get("missing_fields", []))
        status = rule_result.get("status", "ineligible")
        eligibility = rule_result.get("eligible")
        score = rule_result.get("score", 0)

        allowed_industries = [str(code) for code in grant.get("eligible_industries", []) if str(code)]
        if allowed_industries:
            allowed_set = set(allowed_industries)
            business_codes = list_naics_codes(user_data)
            industry_debug: Dict[str, Any] = {
                "allowed": sorted(allowed_set),
                "business_codes": business_codes,
            }
            if user_data.get("business_industry_naics") is not None:
                industry_debug["business_industry_naics"] = user_data.get("business_industry_naics")
            if business_codes:
                matched = sorted(allowed_set & set(business_codes))
                industry_debug["matched"] = matched
                if matched:
                    reasoning.append(
                        f"✅ business_industry_naics = {business_codes} matches allowed industries {sorted(allowed_set)}"
                    )
                else:
                    reasoning.append(
                        f"❌ business_industry_naics = {business_codes}, expected one of {sorted(allowed_set)}"
                    )
                    eligibility = False
                    status = "ineligible"
                    score = 0
            else:
                industry_debug["matched"] = []
                reasoning.append(
                    f"❌ business_industry_naics missing, expected one of {sorted(allowed_set)}"
                )
                if eligibility is True:
                    eligibility = None
                if status != "ineligible":
                    status = "conditional"
                if "business_industry_naics" not in missing_fields:
                    missing_fields.append("business_industry_naics")
            debug_data["industry"] = industry_debug

        # ensure missing fields remain unique but preserve order
        seen_missing = set()
        deduped_missing: List[str] = []
        for field in missing_fields:
            if field not in seen_missing:
                seen_missing.add(field)
                deduped_missing.append(field)
        missing_fields = deduped_missing

        if status == "conditional":
            reasoning.append(
                f"Conditional result: missing fields {missing_fields} prevent full validation"
            )

        if status == "eligible":
            rationale = "Meets all eligibility criteria"
        elif status == "conditional":
            rationale = (
                f"Missing required fields: {', '.join(missing_fields)}"
                if missing_fields
                else "Additional information required"
            )
        else:
            fail_msgs = [msg for msg in reasoning if msg.startswith("❌")]
            rationale = (
                fail_msgs[0].replace("❌ ", "") if fail_msgs else "Did not meet mandatory criteria"
            )

        result = {
            "name": grant.get("name"),
            "eligible": eligibility,
            "score": score,
            "certainty_level": rule_result.get("certainty"),
            "estimated_amount": amount,
            "reasoning": reasoning,
            "debug": debug_data,
            "missing_fields": missing_fields,
            "tag_score": tag_score,
            "reasoning_steps": [],
            "llm_summary": "",
            "next_steps": "" if status == "eligible" else "Review eligibility criteria",
            "status": status,
            "rationale": rationale[:200],
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
                "status": "conditional",
                "rationale": "Fallback grant based on partial information",
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
