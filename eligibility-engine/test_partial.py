import json
from pathlib import Path

from engine import analyze_eligibility


def test_partial_payload():
    payload_path = Path(__file__).parent / "test_payload_partial.json"
    with payload_path.open() as f:
        payload = json.load(f)
    results = analyze_eligibility(payload, explain=True)
    assert any(r['score'] > 0 for r in results)
    # none should be fully eligible because of failing rules or missing data
    assert not all(r['eligible'] is True for r in results)
