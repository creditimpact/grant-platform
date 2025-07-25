"""Very lightweight file-based session memory."""
from pathlib import Path
import json
from typing import Dict, Any, List

MEM_DIR = Path(__file__).parent / "memory"
MEM_DIR.mkdir(exist_ok=True)


def load_memory(session_id: str) -> List[Dict[str, Any]]:
    path = MEM_DIR / f"{session_id}.json"
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def append_memory(session_id: str, record: Dict[str, Any]) -> None:
    data = load_memory(session_id)
    data.append(record)
    path = MEM_DIR / f"{session_id}.json"
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def get_missing_fields(session_id: str) -> List[str]:
    """Aggregate missing fields from stored eligibility results."""
    missing: List[str] = []
    for entry in load_memory(session_id):
        res = entry.get("results")
        if isinstance(res, list):
            for r in res:
                missing.extend(r.get("debug", {}).get("missing_fields", []))
    return sorted(set(missing))


def get_conversation(session_id: str) -> List[Dict[str, Any]]:
    """Return full conversation history for this session."""
    return load_memory(session_id)
