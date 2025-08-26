from engine import analyze_eligibility
import json
from pathlib import Path


def test_engine_returns_status_and_rationale_for_eligible():
    payload = json.load(open(Path(__file__).resolve().parent.parent / 'test_payload.json'))
    res = analyze_eligibility(payload)
    g = res[0]
    assert g['status'] == 'eligible'
    assert isinstance(g['rationale'], str) and len(g['rationale']) >= 3


def test_engine_returns_status_and_rationale_for_conditional():
    res = analyze_eligibility({})
    g = res[0]
    assert g['status'] == 'conditional'
    assert isinstance(g['rationale'], str) and len(g['rationale']) >= 3


def test_engine_returns_status_and_rationale_for_ineligible():
    payload = {
        'owner_gender': 'male',
        'owner_minority': False,
        'ownership_percentage': 60,
        'owner_is_decision_maker': True,
        'business_age_years': 2,
        'number_of_employees': 5,
        'annual_revenue': 500000,
        'business_location_state': 'CA',
    }
    res = analyze_eligibility(payload)
    g = next(r for r in res if r['status'] == 'ineligible')
    assert isinstance(g['rationale'], str) and len(g['rationale']) >= 3
