from engine import analyze_eligibility


def test_partial_payload_returns_conditional_grant():
    results = analyze_eligibility({})
    assert results and len(results) == 1
    res = results[0]
    assert res["eligible"] is None
    assert res.get("certainty_level") == "low"
    assert res.get("estimated_amount", 0) > 0


def test_ineligible_payload_still_returns_fallback():
    payload = {"w2_employee_count": 0, "revenue_drop_percent": 10, "gov_shutdown": False}
    results = analyze_eligibility(payload)
    assert results and len(results) == 1
    assert results[0]["eligible"] is None
    assert results[0].get("estimated_amount", 0) > 0
