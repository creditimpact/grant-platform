import json
from pathlib import Path

from normalization.ingest import normalize_payload
from engine import analyze_eligibility


def _load_expected(program_dir: Path):
    with (program_dir / 'expected_eligible.json').open() as f:
        return json.load(f)


def _load_input(program_dir: Path):
    with (program_dir / 'input_eligible.json').open() as f:
        return json.load(f)


def test_program_fixtures_parity():
    fixtures_dir = Path(__file__).parent / 'fixtures'
    for program_dir in fixtures_dir.iterdir():
        input_payload = _load_input(program_dir)
        expected = _load_expected(program_dir)
        normalized = normalize_payload(input_payload)
        results = analyze_eligibility(normalized)
        result = next(r for r in results if r['name'] == expected['name'])
        for key, value in expected.items():
            if key == 'requiredForms':
                assert sorted(set(result.get(key, []))) == sorted(value)
            else:
                assert result.get(key) == value
