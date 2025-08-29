from pydantic import BaseModel
import re

class IRS941XFields(BaseModel):
    ein: str | None = None
    year: str | None = None
    quarter: str | None = None
    date_discovered: str | None = None

EIN_RE = re.compile(r"\b(employer identification number|EIN)\b[^0-9]*([0-9\-]{9,})", re.I)
YEAR_RE = re.compile(r"calendar year[^0-9]*([12][0-9]{3})", re.I)
Q_RE = re.compile(r"\b(1|2|3|4)\s*:\s*(January|April|July|October)", re.I)
DISC_RE = re.compile(r"date you discovered errors[^0-9]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})", re.I)

def extract(text: str) -> dict:
    f = IRS941XFields()
    if m := EIN_RE.search(text):
        f.ein = m.group(2).replace("-", "")
    if m := YEAR_RE.search(text):
        f.year = m.group(1)
    if m := Q_RE.search(text):
        f.quarter = m.group(1)
    if m := DISC_RE.search(text):
        f.date_discovered = m.group(1)
    return {"fields": f.model_dump(), "confidence": 0.7}
