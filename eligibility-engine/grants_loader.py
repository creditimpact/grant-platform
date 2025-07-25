from pathlib import Path
import json
from typing import List, Dict, Any


GRANTS_DIR = Path(__file__).parent / "grants"


def load_grants() -> List[Dict[str, Any]]:
    """Load all grant JSON files from the grants directory."""
    grants: List[Dict[str, Any]] = []
    for path in GRANTS_DIR.glob("*.json"):
        with path.open("r", encoding="utf-8") as f:
            grant = json.load(f)
            grant["key"] = path.stem
            grants.append(grant)
    return grants
