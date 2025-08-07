from engine import analyze_eligibility


def get_grant(results):
    return next(r for r in results if r["name"] == "Rural Development Grant")


def test_community_facilities_award():
    payload = {
        "entity_type": "municipality",
        "service_area_population": 4000,
        "income_level": "low",
        "project_type": "community_facilities",
        "project_cost": 100000,
    }
    results = analyze_eligibility(payload, explain=True)
    grant = get_grant(results)
    assert grant["eligible"] is True
    assert grant["estimated_amount"] == 75000
    assert "form_sf424" in grant.get("requiredForms", [])
    assert "form_424A" in grant.get("requiredForms", [])
    assert "form_RD_400_1" in grant.get("requiredForms", [])


def test_rcdg_cap():
    payload = {
        "entity_type": "nonprofit",
        "service_area_population": 4000,
        "income_level": "low",
        "project_type": "rcdg",
        "project_cost": 500000,
    }
    results = analyze_eligibility(payload, explain=True)
    grant = get_grant(results)
    assert grant["eligible"] is True
    assert grant["estimated_amount"] == 200000


def test_redlg_cap():
    payload = {
        "entity_type": "public_entity",
        "service_area_population": 10000,
        "income_level": "low",
        "project_type": "redlg",
        "project_cost": 800000,
    }
    results = analyze_eligibility(payload, explain=True)
    grant = get_grant(results)
    assert grant["eligible"] is True
    assert grant["estimated_amount"] == 300000


def test_ineligible_population():
    payload = {
        "entity_type": "municipality",
        "service_area_population": 60000,
        "income_level": "low",
        "project_type": "community_facilities",
        "project_cost": 100000,
    }
    results = analyze_eligibility(payload, explain=True)
    grant = get_grant(results)
    assert grant["eligible"] is False
