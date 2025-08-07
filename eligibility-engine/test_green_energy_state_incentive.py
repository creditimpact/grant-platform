from engine import analyze_eligibility


def get_grant(results):
    return next(r for r in results if r["name"] == "Green Energy State Incentive")


def test_nyserda_award_cap():
    payload = {
        "state": "NY",
        "applicant_type": "business",
        "project_type": "pv",
        "project_cost": 600000,
        "system_size_kw": 500,
        "certified_installer": True,
        "approved_equipment": True,
        "equity_eligible_contractor": True,
    }
    results = analyze_eligibility(payload, explain=True)
    grant = get_grant(results)
    assert grant["eligible"] is True
    assert grant["estimated_amount"] == 500000


def test_il_equity_requirement_fail():
    payload = {
        "state": "IL",
        "applicant_type": "business",
        "project_type": "solar",
        "project_cost": 10000,
        "system_size_kw": 10,
        "certified_installer": True,
        "approved_equipment": True,
        "equity_eligible_contractor": False,
    }
    results = analyze_eligibility(payload, explain=True)
    grant = get_grant(results)
    assert grant["eligible"] is False


def test_ineligible_state():
    payload = {
        "state": "WA",
        "applicant_type": "business",
        "project_type": "solar",
        "project_cost": 20000,
        "system_size_kw": 20,
        "certified_installer": True,
        "approved_equipment": True,
        "equity_eligible_contractor": True,
    }
    results = analyze_eligibility(payload, explain=True)
    grant = get_grant(results)
    assert grant["eligible"] is False
