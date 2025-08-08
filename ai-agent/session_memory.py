"""MongoDB-backed session memory."""
from typing import Dict, Any, List
from pymongo import MongoClient
import os

MONGO_URI = os.getenv("MONGO_URI")
if not MONGO_URI and os.getenv("NODE_ENV") == "development":
    MONGO_URI = "mongodb://localhost:27017"
if not MONGO_URI:
    raise ValueError("MONGO_URI environment variable is not set")
client = MongoClient(MONGO_URI)
db = client["ai_agent"]
collection = db["session_memory"]


def load_memory(session_id: str) -> List[Dict[str, Any]]:
    doc = collection.find_one({"_id": session_id})
    return doc.get("records", []) if doc else []


def append_memory(session_id: str, record: Dict[str, Any]) -> None:
    collection.update_one({"_id": session_id}, {"$push": {"records": record}}, upsert=True)


def save_draft_form(session_id: str, form_key: str, fields: Dict[str, Any]) -> None:
    """Store draft form content for later review."""
    append_memory(session_id, {"draft_form": form_key, "fields": fields})


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
