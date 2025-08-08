"""MongoDB-backed session memory."""
from typing import Dict, Any, List
from pymongo import MongoClient
import os

# Require explicit credentials and TLS for all connections
MONGO_URI = os.getenv("MONGO_URI")
MONGO_USER = os.getenv("MONGO_USER")
MONGO_PASS = os.getenv("MONGO_PASS")
MONGO_CA_FILE = os.getenv("MONGO_CA_FILE")

if not all([MONGO_URI, MONGO_USER, MONGO_PASS]):
    raise ValueError("MONGO_URI, MONGO_USER, and MONGO_PASS must be set")

client = MongoClient(
    MONGO_URI,
    username=MONGO_USER,
    password=MONGO_PASS,
    tls=True,
    tlsCAFile=MONGO_CA_FILE,
    authSource=os.getenv("MONGO_AUTH_DB", "admin"),
    tlsAllowInvalidCertificates=False,
)
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
