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
    }
    results = analyze_eligibility(user, explain=True)
    assert any(r["eligible"] for r in results)
