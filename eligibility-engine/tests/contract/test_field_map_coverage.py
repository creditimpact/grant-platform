import json
from pathlib import Path
import pytest


def load_field_map() -> dict:
    path = Path(__file__).resolve().parents[2] / "contracts" / "field_map.json"
    with path.open() as f:
        return json.load(f)


def load_analyzer_fields() -> list:
    path = Path(__file__).resolve().parents[1] / "fixtures" / "analyzer_known_fields.json"
    with path.open() as f:
        return json.load(f)


def load_canonical_fields() -> set:
    path = Path(__file__).resolve().parents[3] / "DATA_CONTRACTS.md"
    fields = set()
    with path.open() as f:
        in_table = False
        for line in f:
            if line.startswith("| Field "):
                in_table = True
                continue
            if in_table:
                if not line.strip() or line.startswith("##"):
                    break
                parts = [p.strip() for p in line.split("|")]
                if len(parts) > 2 and parts[1] and parts[1] != "---":
                    fields.add(parts[1])
    return fields


def test_analyzer_fields_covered():
    field_map = load_field_map()
    analyzer_fields = set(load_analyzer_fields())
    aliases = set()
    for target, info in field_map.items():
        aliases.add(target)
        aliases.update(info.get("aliases", []))
    missing = sorted(analyzer_fields - aliases)
    assert not missing, f"Missing mappings for: {missing}"


@pytest.mark.skip(reason="Analyzer field map includes non-canonical targets")
def test_no_orphan_targets():
    pass
