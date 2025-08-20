import sys
import json
import glob
import os
from pathlib import Path

def collect() -> dict:
    grants_dir = Path(__file__).resolve().parent.parent / "grants"
    result = {}
    for path in grants_dir.glob("*.json"):
        with path.open() as f:
            data = json.load(f)
        key = path.stem
        req = data.get("required_fields", [])
        result[key] = {
            "required_fields": req,
            "optional_fields": []
        }
    return result

if __name__ == "__main__":
    json.dump(collect(), sys.stdout, indent=2)
