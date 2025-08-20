from normalization.ingest import normalize_payload


def test_basic_normalization():
    raw = {
        'ownership_pct': '55%',
        'annual_revenue': '$1,200,000',
        'ein': '123456789',
        'some_date': '12/31/2024',
        'bool_yes': 'yes',
        'bool_no': 'n'
    }
    normalized = normalize_payload(raw)
    assert normalized['ownership_percentage'] == 55.0
    assert normalized['annual_revenue'] == 1200000
    assert normalized['employer_identification_number'] == '12-3456789'
    assert normalized['some_date'] == '2024-12-31'
    assert normalized['bool_yes'] is True
    assert normalized['bool_no'] is False
