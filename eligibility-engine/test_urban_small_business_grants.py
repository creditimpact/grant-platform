from engine import analyze_eligibility


def get_grant(results):
    return next(r for r in results if r["name"] == "Urban Small Business Grants (2025)")


def test_chicago_microbusiness_award():
    payload = {
        "city": "Chicago",
        "employee_count": 3,
        "annual_revenue": 150000,
        "revenue_decline_percent": 40,
        "business_age_years": 2,
        "industry": "retail",
        "owner_veteran": False,
        "owner_minority": False,
        "covid_impact": True,
        "structural_damage": False,
        "geographic_zone": "south"
    }
    results = analyze_eligibility(payload, explain=True)
    grant = get_grant(results)
    assert grant["eligible"] is True
    assert grant["estimated_amount"] == 5000
    assert grant["debug"]["selected_group"] == "chicago_microbusiness"
    assert "W-9" in grant["requiredForms"]


def test_missing_fields_returns_null():
    payload = {
        "city": "Chicago",
        "employee_count": 3
    }
    results = analyze_eligibility(payload, explain=True)
    grant = get_grant(results)
    assert grant["eligible"] is None
    assert "missing_fields" in grant["debug"]


def test_ineligible_city():
    payload = {
        "city": "Miami",
        "employee_count": 3,
        "annual_revenue": 150000,
        "revenue_decline_percent": 40,
        "business_age_years": 2,
        "industry": "retail",
        "owner_veteran": False,
        "owner_minority": False,
        "covid_impact": True,
        "structural_damage": False,
        "geographic_zone": "south"
    }
    results = analyze_eligibility(payload, explain=True)
    grant = get_grant(results)
    assert grant["eligible"] is False
