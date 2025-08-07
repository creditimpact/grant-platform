from engine import analyze_eligibility


def base_payload():
    return {
        "gross_receipts": "3000000",
        "years_active": "3",
        "technological_uncertainty": True,
        "experimental_process": True,
        "scientific_process": True,
        "rd_credit_amount": "150000",
        "payroll_tax_liability": "120000",
        "carryforward_credit": "0",
        "election_filing_quarter": 1,
        "current_quarter": 2,
        "tax_year": 2023,
    }


def _get_grant(results):
    return next(g for g in results if g["name"] == "Tech Startup Payroll Credit")


def test_startup_payroll_credit_eligible():
    payload = base_payload()
    results = analyze_eligibility(payload, explain=True)
    grant = _get_grant(results)
    assert grant["eligible"] is True
    assert grant["estimated_amount"] == 120000
    assert grant["debug"]["award"]["carryforward"] == 30000


def test_startup_payroll_credit_ineligible_gross_receipts():
    payload = base_payload()
    payload["gross_receipts"] = 6000000
    results = analyze_eligibility(payload, explain=True)
    grant = _get_grant(results)
    assert grant["eligible"] is False


def test_startup_payroll_credit_ineligible_years_active():
    payload = base_payload()
    payload["years_active"] = 6
    results = analyze_eligibility(payload, explain=True)
    grant = _get_grant(results)
    assert grant["eligible"] is False


def test_startup_payroll_credit_carryforward_cap():
    payload = base_payload()
    payload["payroll_tax_liability"] = 200000
    payload["rd_credit_amount"] = 600000
    results = analyze_eligibility(payload, explain=True)
    grant = _get_grant(results)
    assert grant["estimated_amount"] == 200000
    assert grant["debug"]["award"]["carryforward"] == 300000
