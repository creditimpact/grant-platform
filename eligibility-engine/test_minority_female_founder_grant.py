from engine import analyze_eligibility


def base_payload():
    return {
        "owner_gender": "female",
        "owner_minority": True,
        "ownership_percentage": 60,
        "owner_is_decision_maker": True,
        "business_age_years": 1,
        "number_of_employees": 10,
        "annual_revenue": 500000,
        "business_location_state": "CA",
        "tags": ["women", "minority", "startup"],
    }


def get_grant(results):
    return next(r for r in results if r["name"] == "Minority Female Founder Grant")


def test_minority_female_founder_eligible():
    payload = base_payload()
    results = analyze_eligibility(payload, explain=True)
    grant = get_grant(results)
    assert grant["eligible"] is True
    assert grant["estimated_amount"] == 20000


def test_minority_female_founder_ineligible_ownership():
    payload = base_payload()
    payload["ownership_percentage"] = 50
    results = analyze_eligibility(payload, explain=True)
    grant = get_grant(results)
    assert grant["eligible"] is False


def test_minority_female_founder_ineligible_gender():
    payload = base_payload()
    payload["owner_gender"] = "male"
    results = analyze_eligibility(payload, explain=True)
    grant = get_grant(results)
    assert grant["eligible"] is False


def test_minority_female_founder_ineligible_minority():
    payload = base_payload()
    payload["owner_minority"] = False
    results = analyze_eligibility(payload, explain=True)
    grant = get_grant(results)
    assert grant["eligible"] is False


def test_minority_female_founder_ineligible_employees():
    payload = base_payload()
    payload["number_of_employees"] = 51
    results = analyze_eligibility(payload, explain=True)
    grant = get_grant(results)
    assert grant["eligible"] is False


def test_minority_female_founder_ineligible_revenue():
    payload = base_payload()
    payload["annual_revenue"] = 4000000
    results = analyze_eligibility(payload, explain=True)
    grant = get_grant(results)
    assert grant["eligible"] is False


def test_minority_female_founder_ineligible_age():
    payload = base_payload()
    payload["business_age_years"] = 0.4
    results = analyze_eligibility(payload, explain=True)
    grant = get_grant(results)
    assert grant["eligible"] is False


def test_minority_female_founder_ineligible_decision_maker():
    payload = base_payload()
    payload["owner_is_decision_maker"] = False
    results = analyze_eligibility(payload, explain=True)
    grant = get_grant(results)
    assert grant["eligible"] is False
