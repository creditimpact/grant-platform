import re
from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel

INVOICE_KEYWORDS = [
    "Invoice",
    "Tax Invoice",
    "Commercial Invoice",
    "Amount Due",
]

QUOTE_KEYWORDS = [
    "Quote",
    "Quotation",
    "Estimate",
    "Proposal",
    "Valid until",
]


def detect(text: str) -> bool:
    t = text.lower()
    return any(k.lower() in t for k in INVOICE_KEYWORDS + QUOTE_KEYWORDS)


class IOQFields(BaseModel):
    doc_variant: Optional[str] = None
    vendor_name: Optional[str] = None
    vendor_tax_id: Optional[str] = None
    customer_name: Optional[str] = None
    customer_address: Optional[str] = None
    invoice_number: Optional[str] = None
    quote_number: Optional[str] = None
    issue_date: Optional[str] = None
    due_date: Optional[str] = None
    quote_valid_until: Optional[str] = None
    item_description: Optional[str] = None
    quantity: Optional[float] = None
    unit_price: Optional[float] = None
    subtotal_amount: Optional[float] = None
    tax_amount: Optional[float] = None
    total_amount: Optional[float] = None
    currency: Optional[str] = None


DATE_FMTS = ["%Y-%m-%d", "%m/%d/%Y", "%B %d, %Y", "%b %d, %Y"]


def _norm_date(val: str) -> str:
    for fmt in DATE_FMTS:
        try:
            return datetime.strptime(val.strip(), fmt).date().isoformat()
        except ValueError:
            continue
    return val.strip()


VENDOR_TAX_ID_RE = re.compile(r"(EIN|TIN|VAT|Tax ID)[:\s]+([\w-]+)", re.I)
INVOICE_NO_RE = re.compile(r"Invoice (?:No\.|#)[:\s]+([\w\-\/]+)", re.I)
QUOTE_NO_RE = re.compile(r"(Quote|Estimate|Proposal) (?:No\.|#)[:\s]+([\w\-\/]+)", re.I)
ISSUE_DATE_RE = re.compile(r"(Date|Issued?)[:\s]+([A-Za-z]{3,9} \d{1,2}, \d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}/\d{1,2}/\d{2,4})", re.I)
DUE_DATE_RE = re.compile(r"Due Date[:\s]+([A-Za-z]{3,9} \d{1,2}, \d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}/\d{1,2}/\d{2,4})", re.I)
VALID_UNTIL_RE = re.compile(r"Valid (?:Until|Thru|Through)[:\s]+([A-Za-z]{3,9} \d{1,2}, \d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}/\d{1,2}/\d{2,4})", re.I)
ITEM_LINE_RE = re.compile(r"^(.+?)\s{2,}(\d+(?:\.\d+)?)\s{2,}([\$€£₪]?)([0-9,]+(?:\.\d{2})?)", re.M)
SUBTOTAL_RE = re.compile(r"Sub-?total[:\s]+([\$€£₪]?)([0-9,]+(?:\.\d{2})?)", re.I)
TAX_RE = re.compile(r"(?:Tax|Sales Tax)[:\s]+([\$€£₪]?)([0-9,]+(?:\.\d{2})?)", re.I)
TOTAL_RE = re.compile(r"(?:Total (?:Amount|Due)?|Amount Due|Grand Total)[:\s]+([\$€£₪]?)([0-9,]+(?:\.\d{2})?)", re.I)
CURRENCY_TOKEN_RE = re.compile(r"\b(USD|EUR|ILS|GBP)\b", re.I)

CURRENCY_SYMBOLS = {
    "$": "USD",
    "€": "EUR",
    "₪": "ILS",
    "£": "GBP",
}


def _parse_amount(symbol: str, value: str) -> tuple[Optional[float], Optional[str]]:
    amount = float(value.replace(",", ""))
    currency = CURRENCY_SYMBOLS.get(symbol)
    return amount, currency


def extract(text: str, evidence_key: Optional[str] = None) -> Dict[str, Any]:
    if not detect(text):
        return {
            "doc_type": None,
            "confidence": 0.0,
            "fields": {},
            "evidence_key": evidence_key,
        }

    f = IOQFields()
    lower = text.lower()
    if any(k.lower() in lower for k in INVOICE_KEYWORDS):
        f.doc_variant = "invoice"
    elif any(k.lower() in lower for k in QUOTE_KEYWORDS):
        f.doc_variant = "quote"

    lines = text.strip().splitlines()
    if lines:
        f.vendor_name = lines[0].strip()

    if m := VENDOR_TAX_ID_RE.search(text):
        f.vendor_tax_id = m.group(2).strip()

    if m := re.search(r"(?:Bill To|Customer)[:\s]+([^\n]+)\n([^\n]+)?", text, re.I):
        f.customer_name = m.group(1).strip()
        if m.group(2):
            f.customer_address = m.group(2).strip()

    if m := INVOICE_NO_RE.search(text):
        f.invoice_number = m.group(1).strip()
    if m := QUOTE_NO_RE.search(text):
        f.quote_number = m.group(2).strip()
    if m := ISSUE_DATE_RE.search(text):
        f.issue_date = _norm_date(m.group(2))
    if m := DUE_DATE_RE.search(text):
        f.due_date = _norm_date(m.group(1))
    if m := VALID_UNTIL_RE.search(text):
        f.quote_valid_until = _norm_date(m.group(1))
    if m := ITEM_LINE_RE.search(text):
        f.item_description = m.group(1).strip()
        f.quantity = float(m.group(2))
        amt, curr = _parse_amount(m.group(3), m.group(4))
        f.unit_price = amt
        if curr:
            f.currency = curr
    if m := SUBTOTAL_RE.search(text):
        amt, curr = _parse_amount(m.group(1), m.group(2))
        f.subtotal_amount = amt
        if curr and not f.currency:
            f.currency = curr
    if m := TAX_RE.search(text):
        amt, curr = _parse_amount(m.group(1), m.group(2))
        f.tax_amount = amt
        if curr and not f.currency:
            f.currency = curr
    if m := TOTAL_RE.search(text):
        amt, curr = _parse_amount(m.group(1), m.group(2))
        f.total_amount = amt
        if curr and not f.currency:
            f.currency = curr

    if not f.currency:
        if m := CURRENCY_TOKEN_RE.search(text):
            f.currency = m.group(1).upper()

    confidence = 0.6
    has_number_date = (f.invoice_number or f.quote_number) and (f.issue_date or f.due_date or f.quote_valid_until)
    if has_number_date:
        confidence += 0.1
    if f.vendor_name and f.customer_name:
        confidence += 0.1
    if f.total_amount is not None:
        confidence += 0.1
    confidence = min(confidence, 0.95)

    return {
        "doc_type": "Invoices_or_Quotes",
        "confidence": confidence,
        "fields": f.model_dump(),
        "evidence_key": evidence_key,
    }


__all__ = ["detect", "extract"]
