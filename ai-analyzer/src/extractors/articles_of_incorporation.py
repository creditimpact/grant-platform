from datetime import datetime
import re
from pydantic import BaseModel

KEYWORDS = [
    "Articles of Incorporation",
    "Articles of Organization",
    "Certificate of Incorporation",
    "Certificate of Formation",
    "Secretary of State",
]


def detect_articles_of_incorporation(text: str) -> bool:
    t = text.lower()
    return any(k.lower() in t for k in KEYWORDS)


class ArticlesOfIncorporationFields(BaseModel):
    business_name: str | None = None
    entity_type: str | None = None
    date_of_incorporation: str | None = None
    state_of_incorporation: str | None = None
    registered_agent: str | None = None


def _normalize_date(val: str) -> str:
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%m-%d-%Y"):
        try:
            return datetime.strptime(val, fmt).date().isoformat()
        except ValueError:
            continue
    return val


BUSINESS_NAME_RE = re.compile(r"(?:Company|Business)?\s*Name\s*[:\-]\s*(.+)", re.I)
ENTITY_TYPE_RE = re.compile(r"Entity\s*Type\s*[:\-]\s*(.+)", re.I)
DATE_RE = re.compile(r"(?:Date\s*of\s*Incorporation|Effective\s*Date|Date)\s*[:\-]\s*([0-9/\-]+)", re.I)
STATE_RE = re.compile(r"State\s*of\s*Incorporation\s*[:\-]\s*(.+)", re.I)
REGISTERED_AGENT_RE = re.compile(r"Registered\s*Agent\s*[:\-]\s*(.+)", re.I)


def extract(text: str) -> dict:
    f = ArticlesOfIncorporationFields()
    if m := BUSINESS_NAME_RE.search(text):
        f.business_name = m.group(1).strip()
    if m := ENTITY_TYPE_RE.search(text):
        f.entity_type = m.group(1).strip()
    if m := DATE_RE.search(text):
        f.date_of_incorporation = _normalize_date(m.group(1).strip())
    if m := STATE_RE.search(text):
        f.state_of_incorporation = m.group(1).strip()
    if m := REGISTERED_AGENT_RE.search(text):
        f.registered_agent = m.group(1).strip()
    return {"fields": f.model_dump(), "confidence": 0.6}
