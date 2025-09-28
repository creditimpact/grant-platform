import pytest

from engine import analyze_eligibility
from normalization.ingest import normalize_payload


def _find_result(results, name: str):
    for result in results:
        if result["name"] == name:
            return result
    raise AssertionError(f"Grant {name!r} not found in results")


def test_restaurant_maps_to_food_services_and_matches_urban_grant():
    payload = {
        "business_name": "Loop Bistro",
        "industry": "Restaurant",
        "tags": ["restaurant", "food", "hospitality"],
        "city": "Chicago",
        "employee_count": 4,
        "annual_revenue": 320000,
        "revenue_decline_percent": 30,
        "business_age_years": 6,
        "owner_veteran": False,
        "owner_minority": False,
        "covid_impact": True,
        "structural_damage": False,
        "geographic_zone": "loop",
    }

    normalized = normalize_payload(payload)
    normalized["employee_count"] = normalized.get("number_of_employees")
    naics = normalized.get("business_industry_naics")
    assert naics and naics["code"] == "722"

    results = analyze_eligibility(normalized, explain=True)
    urban = _find_result(results, "Urban Small Business Grants (2025)")
    assert urban["eligible"] is True
    assert urban["status"] == "eligible"
    assert any("business_industry_naics" in step for step in urban["reasoning"])


def test_construction_business_matches_green_energy_incentive():
    payload = {
        "business_name": "SolarBuild Co.",
        "industry": "Construction and solar installation",
        "tags": ["construction", "solar"],
        "state": "CA",
        "applicant_type": "business",
        "project_type": "battery_storage",
        "project_cost": 250000,
        "system_size_kw": 150,
        "certified_installer": True,
        "approved_equipment": True,
        "equity_eligible_contractor": False,
    }

    normalized = normalize_payload(payload)
    normalized["state"] = normalized.get("business_location_state")
    naics = normalized.get("business_industry_naics")
    assert naics and naics["code"] == "236"

    results = analyze_eligibility(normalized, explain=True)
    green = _find_result(results, "Green Energy State Incentive")
    assert green["eligible"] is True
    assert green["status"] == "eligible"
    assert green["debug"].get("industry", {}).get("matched") == ["236"]


def test_tech_startup_qualifies_for_women_owned_tech_grant():
    payload = {
        "business_name": "CloudOptima Labs",
        "industry": "Technology startup providing SaaS analytics",
        "business_description": "SaaS platform for supply chain analytics",
        "tags": ["software", "SaaS", "women led"],
        "sba_small_business": True,
        "women_ownership_percent": 80,
        "women_us_citizen_residents": True,
        "women_controlled": True,
        "woman_leader_full_time": True,
        "for_profit": True,
        "entity_type": "llc",
        "owner_debarred": False,
        "federal_litigation": False,
        "us_based_or_impact": True,
        "owner_net_worths": [500000],
        "owner_avg_incomes": [200000],
        "owner_total_assets": [3000000],
        "num_employees": 45,
        "us_ownership_percent": 80,
        "institutional_investor_controlled": False,
        "research_location": "us",
        "has_research_institution_partner": True,
        "sam_registered": True,
        "self_certified": True,
    }

    normalized = normalize_payload(payload)
    naics = normalized.get("business_industry_naics")
    assert naics and naics["code"] in {"334", "518"}

    results = analyze_eligibility(normalized, explain=True)
    women_tech = _find_result(results, "Women-Owned Tech Grant")
    assert women_tech["eligible"] is True
    assert women_tech["status"] == "eligible"
    assert women_tech["debug"].get("industry", {}).get("matched")
