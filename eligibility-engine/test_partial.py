import json
from engine import analyze_eligibility


def test_partial_payload():
    with open('test_payload_partial.json') as f:
        payload = json.load(f)
    results = analyze_eligibility(payload, explain=True)
    assert any(r['score'] > 0 for r in results)
    # none should be fully eligible because of failing rules or missing data
    assert not all(r['eligible'] is True for r in results)
