import re
from typing import Dict

def extract(text: str) -> Dict[str, str]:
    out = {}
    m = re.search(r"EIN[:\s]+([0-9\-]{9,10})", text, flags=re.I)
    if m: out["ein"] = m.group(1)
    m = re.search(r"For tax year ending[:\s]+([A-Za-z]{3,9}\s+\d{4})", text, flags=re.I)
    if m: out["tax_year_ending"] = m.group(1)
    # add more targeted captures as needed
    return out
