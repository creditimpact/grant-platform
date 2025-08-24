import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[2]))
from normalization.ingest import normalize_payload


def test_basic_normalization():
    raw = {
        'ownership_pct': '55%',
        'annual_revenue': '$1,200,000',
        'ein': '123456789',
        'some_date': '12/31/2024',
        'bool_yes': 'yes',
        'bool_no': 'n',
        'payroll_total': '($1.2M)',
        'revenue_drop_2020_pct': '0.4',
        'shutdown_2020': 'Yes'
    }
    normalized = normalize_payload(raw)
    assert normalized['ownership_percentage'] == 55.0
    assert normalized['annual_revenue'] == 1200000
    assert normalized['employer_identification_number'] == '12-3456789'
    assert normalized['some_date'] == '2024-12-31'
    assert normalized['bool_yes'] is True
    assert normalized['bool_no'] is False
    assert normalized['payroll_total'] == 1200000
    assert normalized['revenue_drop_2020_percent'] == 40.0
    assert normalized['government_shutdown_2020'] is True
