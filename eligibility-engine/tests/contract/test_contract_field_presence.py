import json
from pathlib import Path


def test_required_fields_covered_by_field_map():
    base = Path(__file__).resolve().parents[2]
    with (base / 'contracts' / 'field_map.json').open() as f:
        fmap = json.load(f)
    with (base / 'contracts' / 'required_fields.json').open() as f:
        required = json.load(f)

    targets = {
        info['target']
        for info in fmap.values()
        if isinstance(info, dict) and 'target' in info
    }
    focus = {"erc", "veteran_owned_business_grant", "rural_development_grant"}
    for program, info in required.items():
        if program not in focus:
            continue
        for field in info['required_fields']:
            assert field in targets, f"{field} missing from field_map"
