from fill_form import fill_form

def test_grant_use_statement_generation():
    data = {
        "business_name": "Acme Co",
        "funding_request_amount": 50000,
        "intended_categories": ["payroll"],
        "justification": "Retain staff",
        "date_signed": "2024-01-01",
    }
    filled = fill_form("grant_use_statement", data)
    sections = filled.get("sections", [])
    text = "\n".join(sections)
    assert "Funding Request: $50000" in text
    assert "- payroll" in text
