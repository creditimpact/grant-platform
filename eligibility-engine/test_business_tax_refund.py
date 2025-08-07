from engine import analyze_eligibility


def _get_grant(results, name):
    return next(g for g in results if g["name"] == name)


def test_business_tax_refund_eligible():
    user = {
        "business_income": 15000,
        "business_expenses": 7000,
        "tax_paid": 3000,
        "business_type": "Corporation",
        "tax_year": 2024,
        "previous_refunds_claimed": False,
    }
    results = analyze_eligibility(user, explain=True)
    grant = _get_grant(results, "Business Tax Refund Grant")
    assert grant["eligible"] is True
    assert grant["estimated_amount"] == 300  # 10% of tax_paid


def test_business_tax_refund_ineligible():
    user = {
        "business_income": 9000,  # below minimum
        "business_expenses": 7000,
        "tax_paid": 3000,
        "business_type": "LLC",
        "tax_year": 2024,
        "previous_refunds_claimed": False,
    }
    results = analyze_eligibility(user, explain=True)
    grant = _get_grant(results, "Business Tax Refund Grant")
    assert grant["eligible"] is False
    assert grant["score"] < 100
