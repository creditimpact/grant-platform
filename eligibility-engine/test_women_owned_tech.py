from engine import analyze_eligibility


def base_payload():
    return {
        "sba_small_business": True,
        "women_ownership_percent": 60,
        "women_us_citizen_residents": True,
        "women_controlled": True,
        "woman_leader_full_time": True,
        "for_profit": True,
        "entity_type": "llc",
        "owner_debarred": False,
        "federal_litigation": False,
        "us_based_or_impact": True,
        "owner_net_worths": [500000, 700000],
        "owner_avg_incomes": [300000, 350000],
        "owner_total_assets": [5000000, 6000000],
        "num_employees": 100,
        "us_ownership_percent": 80,
        "institutional_investor_controlled": False,
        "research_location": "us",
        "has_research_institution_partner": True,
        "sam_registered": True,
        "self_certified": True,
        "tags": ["technology", "women"],
    }


def get_grant(result):
    return next(r for r in result if r["name"] == "Women-Owned Tech Grant")


def test_women_owned_tech_eligible():
    payload = base_payload()
    results = analyze_eligibility(payload, explain=True)
    grant = get_grant(results)
    assert grant["eligible"] is True


def test_women_owned_tech_ineligible_ownership():
    payload = base_payload()
    payload["women_ownership_percent"] = 50
    results = analyze_eligibility(payload, explain=True)
    grant = get_grant(results)
    assert grant["eligible"] is False


def test_women_owned_tech_ineligible_net_worth():
    payload = base_payload()
    payload["owner_net_worths"] = [900000]
    results = analyze_eligibility(payload, explain=True)
    grant = get_grant(results)
    assert grant["eligible"] is False


def test_women_owned_tech_threshold_edge():
    payload = base_payload()
    payload["women_ownership_percent"] = 51
    payload["owner_net_worths"] = [850000]
    payload["owner_avg_incomes"] = [400000]
    payload["owner_total_assets"] = [6500000]
    results = analyze_eligibility(payload, explain=True)
    grant = get_grant(results)
    assert grant["eligible"] is True
