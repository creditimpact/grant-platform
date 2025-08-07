from engine import analyze_eligibility


def get_grant(results):
    return next(r for r in results if r["name"] == "California Small Business Grant (2025)")


def base_payload():
    return {
        "business_location_state": "CA",
        "number_of_employees": 50,
        "annual_revenue": 2000000,
        "registration_year": 2010,
        "owner_state": "NV",
        "sbtaep_training_complete": False,
        "certified_center_approval": False,
        "net_income": 0,
        "business_age_years": 0,
        "us_content_percent": 0,
        "sba_standard_compliant": False,
        "city": "Los Angeles",
        "women_owned": False,
        "technical_assistance_complete": False,
        "route_66_location": False,
        "industry": "retail",
        "project_type": "other",
        "ust_owner_operator": False,
        "annual_fuel_sales_gallons": 0,
        "health_safety_compliant": False,
        "chamber_nomination": False,
        "county": "Other",
        "low_income_community": False,
        "disaster_affected": False,
    }


def test_dream_fund_eligible():
    payload = base_payload()
    payload.update(
        {
            "number_of_employees": 4,
            "annual_revenue": 500000,
            "registration_year": 2021,
            "owner_state": "CA",
            "sbtaep_training_complete": True,
            "certified_center_approval": True,
        }
    )
    results = analyze_eligibility(payload, explain=True)
    grant = get_grant(results)
    assert grant["eligible"] is True
    assert grant["estimated_amount"] == 10000
    assert grant["debug"].get("selected_group") == "california_dream_fund"


def test_step_eligible():
    payload = base_payload()
    payload.update(
        {
            "net_income": 25000,
            "business_age_years": 2,
            "us_content_percent": 80,
            "sba_standard_compliant": True,
        }
    )
    results = analyze_eligibility(payload, explain=True)
    grant = get_grant(results)
    assert grant["eligible"] is True
    assert grant["debug"].get("selected_group") == "california_step"


def test_dream_fund_ineligible_employee_count():
    payload = base_payload()
    payload.update(
        {
            "number_of_employees": 10,
            "annual_revenue": 500000,
            "registration_year": 2021,
            "owner_state": "CA",
            "sbtaep_training_complete": True,
            "certified_center_approval": True,
        }
    )
    results = analyze_eligibility(payload, explain=True)
    grant = get_grant(results)
    assert grant["eligible"] is False
