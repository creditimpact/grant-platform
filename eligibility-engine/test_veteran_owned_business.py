from engine import analyze_eligibility

def base_payload():
    return {
        "owner_veteran": True,
        "owner_spouse": False,
        "ownership_percentage": 60,
        "number_of_employees": 10,
        "annual_revenue": 3000000,
        "business_location_state": "TX",
        "economically_vulnerable_area": True,
        "business_type": "llc",
        "tags": ["veteran", "small_business"],
    }


def get_grant(results):
    return next(r for r in results if r["name"] == "Veteran Owned Business Grant")


def test_veteran_owned_business_eligible():
    payload = base_payload()
    results = analyze_eligibility(payload, explain=True)
    grant = get_grant(results)
    assert grant["eligible"] is True
    assert grant["estimated_amount"] == 10000


def test_veteran_owned_business_threshold_edges():
    payload = base_payload()
    payload.update(
        {
            "ownership_percentage": 51,
            "number_of_employees": 3,
            "annual_revenue": 5000000,
        }
    )
    results = analyze_eligibility(payload, explain=True)
    grant = get_grant(results)
    assert grant["eligible"] is True


def test_veteran_owned_business_ineligible_ownership():
    payload = base_payload()
    payload["ownership_percentage"] = 50
    results = analyze_eligibility(payload, explain=True)
    grant = get_grant(results)
    assert grant["eligible"] is False


def test_veteran_owned_business_ineligible_no_veteran_or_spouse():
    payload = base_payload()
    payload["owner_veteran"] = False
    payload["owner_spouse"] = False
    results = analyze_eligibility(payload, explain=True)
    grant = get_grant(results)
    assert grant["eligible"] is False


def test_veteran_owned_business_ineligible_employee_count():
    payload = base_payload()
    payload["number_of_employees"] = 2
    results = analyze_eligibility(payload, explain=True)
    grant = get_grant(results)
    assert grant["eligible"] is False


def test_veteran_owned_business_ineligible_revenue():
    payload = base_payload()
    payload["annual_revenue"] = 6000000
    results = analyze_eligibility(payload, explain=True)
    grant = get_grant(results)
    assert grant["eligible"] is False


def test_veteran_owned_business_ineligible_location():
    payload = base_payload()
    payload["business_location_state"] = "PR"
    results = analyze_eligibility(payload, explain=True)
    grant = get_grant(results)
    assert grant["eligible"] is False


def test_veteran_owned_business_ineligible_economic_vulnerability():
    payload = base_payload()
    payload["economically_vulnerable_area"] = False
    results = analyze_eligibility(payload, explain=True)
    grant = get_grant(results)
    assert grant["eligible"] is False


def test_veteran_owned_business_ineligible_business_type():
    payload = base_payload()
    payload["business_type"] = "non_profit"
    results = analyze_eligibility(payload, explain=True)
    grant = get_grant(results)
    assert grant["eligible"] is False
