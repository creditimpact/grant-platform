"""MongoDB-backed session memory."""
from typing import Dict, Any, List
from pymongo import MongoClient
from config import settings  # type: ignore
from mongo_uri import build_mongo_uri

# Require explicit credentials and TLS for all connections.
# When running tests without database credentials, the client is not created.
MONGO_URI = getattr(settings, "MONGO_URI", None)
MONGO_USER = getattr(settings, "MONGO_USER", None)
MONGO_PASS = getattr(settings, "MONGO_PASS", None)
MONGO_CA_FILE = getattr(settings, "MONGO_CA_FILE", None)

if MONGO_URI:
    try:
        uri = build_mongo_uri(MONGO_URI, MONGO_USER, MONGO_PASS)
        client = MongoClient(
            uri,
            tls=True,
            tlsCAFile=str(MONGO_CA_FILE) if MONGO_CA_FILE else None,
            authSource=getattr(settings, "MONGO_AUTH_DB", "admin"),
            tlsAllowInvalidCertificates=False,
            serverSelectionTimeoutMS=500,
        )
        db = client["ai_agent"]
        collection = db["session_memory"]
        _memory_store: Dict[str, List[Dict[str, Any]]] | None = None
    except Exception:  # pragma: no cover - fallback for tests
        client = None
        db = None
        collection = None
        _memory_store = {}
else:  # pragma: no cover - db disabled in tests
    client = None
    db = None
    collection = None
    # Simple in-memory store used when MongoDB isn't configured (e.g. in unit
    # tests).  It mimics the structure of the persisted documents.
    _memory_store: Dict[str, List[Dict[str, Any]]] = {}


def load_memory(session_id: str) -> List[Dict[str, Any]]:
    if collection is None:
        return _memory_store.get(session_id, [])
    doc = collection.find_one({"_id": session_id})
    return doc.get("records", []) if doc else []


def append_memory(session_id: str, record: Dict[str, Any]) -> None:
    if collection is None:
        _memory_store.setdefault(session_id, []).append(record)
        return
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
