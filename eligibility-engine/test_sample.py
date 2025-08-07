from engine import analyze_eligibility


def test_engine():
    user = {
        "has_product_or_process_dev": True,
        "is_tech_based": True,
        "qre_total": 60000,
        "revenue_drop": 25,
        "government_shutdown": True,
        "qualified_wages": 50000,
        "business_age_years": 2,
        "owner_credit_score": 680,
        "state": "CA",
        "employees": 5,
        "owner_gender": "female",
        "industry": "technology",
        "city": "New York",
        "owner_minority": True,
        "rural_area": False,
        "tags": ["technology", "startup"],
        "business_income": 150000,
        "business_expenses": 100000,
        "tax_paid": 20000,
        "business_type": "LLC",
        "tax_year": 2024,
        "previous_refunds_claimed": False,
    }
    results = analyze_eligibility(user, explain=True)
    # at least one grant should be fully eligible
    assert any(r["eligible"] is True for r in results)
    # all results should include a score and reasoning
    for r in results:
        assert "score" in r
        assert isinstance(r["reasoning"], list)
