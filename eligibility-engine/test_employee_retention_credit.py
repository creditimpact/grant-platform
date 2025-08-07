from engine import analyze_eligibility


def base_payload():
    return {
        "business_location_country": "US",
        "w2_employee_count": 5,
        "revenue_drop_2020_percent": 0,
        "revenue_drop_2021_percent": 0,
        "government_shutdown_2020": False,
        "government_shutdown_2021": False,
        "qualified_wages_2020": 0,
        "qualified_wages_2021": 0,
        "ppp_wages_double_dip": False,
        "tags": ["covid", "payroll"],
    }


def get_grant(results):
    return next(r for r in results if r["name"] == "Employee Retention Credit")


def test_erc_eligible_revenue_decline_2020():
    payload = base_payload()
    payload.update({
        "revenue_drop_2020_percent": 55,
        "qualified_wages_2020": 10000,
    })
    results = analyze_eligibility(payload, explain=True)
    grant = get_grant(results)
    assert grant["eligible"] is True
    assert grant["estimated_amount"] == 5000


def test_erc_eligible_shutdown_2021():
    payload = base_payload()
    payload.update({
        "government_shutdown_2021": True,
        "qualified_wages_2021": 10000,
    })
    results = analyze_eligibility(payload, explain=True)
    grant = get_grant(results)
    assert grant["eligible"] is True
    assert grant["estimated_amount"] == 7000


def test_erc_ineligible_ppp_overlap():
    payload = base_payload()
    payload.update({
        "revenue_drop_2020_percent": 55,
        "qualified_wages_2020": 10000,
        "ppp_wages_double_dip": True,
    })
    results = analyze_eligibility(payload, explain=True)
    grant = get_grant(results)
    assert grant["eligible"] is False


def test_erc_ineligible_no_event():
    payload = base_payload()
    payload.update({
        "revenue_drop_2020_percent": 10,
        "revenue_drop_2021_percent": 10,
    })
    results = analyze_eligibility(payload, explain=True)
    grant = get_grant(results)
    assert grant["eligible"] is False
