from __future__ import annotations

import logging
import re
from datetime import datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any, Dict

LOG_DIRECTORY = Path("/tmp/session_diagnostics")
LOG_DIRECTORY.mkdir(parents=True, exist_ok=True)
LOG_PATH = LOG_DIRECTORY / "bank_statement_extraction.log"

logging.basicConfig(
    level=logging.DEBUG,
    filename=str(LOG_PATH),
    filemode="a",
    format="%(asctime)s %(levelname)s %(message)s",
)

logger = logging.getLogger("bank_statement_extractor")

CURRENCY_PATTERN = r"\$?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2}))"
DATE_TOKEN_PATTERN = r"(?:\b[A-Za-z]+\s+\d{1,2},?\s*\d{2,4}|\d{1,2}/\d{1,2}/\d{2,4})"
DATE_RANGE_PATTERN = rf"({DATE_TOKEN_PATTERN})\s*-\s*({DATE_TOKEN_PATTERN})"
MONTH_RANGE_PATTERN = r"([A-Za-z]+\s*\d{1,2},?\s*\d{4})"
DATE_FORMATS = (
    "%B %d %Y",
    "%b %d %Y",
    "%B %d, %Y",
    "%b %d, %Y",
    "%m/%d/%Y",
    "%m/%d/%y",
)


def _normalize_amount(token: str | None) -> str | None:
    if not token:
        return None
    cleaned = token.strip()
    if not cleaned:
        return None

    negative = False
    if cleaned.startswith("(") and cleaned.endswith(")"):
        negative = True
        cleaned = cleaned[1:-1]

    cleaned = cleaned.replace("$", "").replace(",", "").replace(" ", "")
    if cleaned.startswith("-"):
        negative = True
        cleaned = cleaned[1:]

    try:
        value = Decimal(cleaned)
    except InvalidOperation:
        logger.debug("Skipping invalid currency token: %s", token)
        return None

    quantized = f"{value:.2f}"
    if negative and quantized != "0.00":
        return f"-{quantized}"
    return quantized


def _parse_date(token: str | None) -> str | None:
    if not token:
        return None
    cleaned = token.strip().replace(",", "")
    if not cleaned:
        return None

    for fmt in DATE_FORMATS:
        try:
            parsed = datetime.strptime(cleaned, fmt).date()
            return parsed.isoformat()
        except ValueError:
            continue
    logger.debug("Unable to parse date token: %s", token)
    return None


def _to_decimal(value: str | None) -> Decimal | None:
    if value is None:
        return None
    try:
        return Decimal(value)
    except InvalidOperation:
        return None


def extract(document_text: str) -> Dict[str, Any]:
    """Extract structured data from a bank statement text."""

    text = (document_text or "").replace("\n", " ").replace("\r", " ")
    logger.debug("[Bank_Statements] Starting extraction for %d characters", len(text))

    result: Dict[str, Any] = {}
    field_confidence: Dict[str, float] = {}
    warnings: list[str] = []

    # --- Account number (last 4 digits) ---
    acct_match = re.search(r"Account number[:\s]+.*?(\d{4})\b", text, re.IGNORECASE)
    if acct_match:
        result["account_number_last4"] = acct_match.group(1)
        field_confidence["account_number_last4"] = 0.7
        logger.debug("Found account_number_last4=%s", result["account_number_last4"])

    # --- Statement period ---
    period_match = re.search(DATE_RANGE_PATTERN, text)
    if period_match:
        start_raw, end_raw = period_match.groups()
        start_iso = _parse_date(start_raw)
        end_iso = _parse_date(end_raw)

        if start_iso or end_iso:
            period: Dict[str, Any] = {}
            if start_iso:
                period["start"] = start_iso
                field_confidence["statement_period.start"] = 0.72
            else:
                warnings.append("Unable to normalize statement period start date")
            if end_iso:
                period["end"] = end_iso
                field_confidence["statement_period.end"] = 0.72
            else:
                warnings.append("Unable to normalize statement period end date")
            if period:
                result["statement_period"] = period
                logger.debug("Detected statement_period=%s", period)

    # --- Beginning balance ---
    begin_match = re.search(
        r"(?:Beginning|Opening|Start(?:ing)?) balance[:\s]*" + CURRENCY_PATTERN,
        text,
        re.IGNORECASE,
    )
    if begin_match:
        normalized = _normalize_amount(begin_match.group(1))
        if normalized is not None:
            result["beginning_balance"] = normalized
            field_confidence["beginning_balance"] = 0.8
            logger.debug("Found beginning_balance=%s", normalized)

    # --- Ending balance ---
    end_match = re.search(
        r"(?:Ending|Closing) balance[:\s]*" + CURRENCY_PATTERN,
        text,
        re.IGNORECASE,
    )
    if end_match:
        normalized = _normalize_amount(end_match.group(1))
        if normalized is not None:
            result["ending_balance"] = normalized
            field_confidence["ending_balance"] = 0.8
            logger.debug("Found ending_balance=%s", normalized)

    # --- Total credits / deposits ---
    credit_match = re.search(
        r"Total (?:credits?|deposits?)(?:\s+posted)?[:\s]*" + CURRENCY_PATTERN,
        text,
        re.IGNORECASE,
    )
    if credit_match:
        normalized = _normalize_amount(credit_match.group(1))
        if normalized is not None:
            result.setdefault("totals", {})["deposits"] = normalized
            field_confidence["totals.deposits"] = 0.78
            logger.debug("Found total_deposits=%s", normalized)

    # --- Total debits / withdrawals ---
    debit_match = re.search(
        r"Total (?:debits?|withdrawals?)(?:\s+posted)?[:\s]*-?" + CURRENCY_PATTERN,
        text,
        re.IGNORECASE,
    )
    if debit_match:
        normalized = _normalize_amount(debit_match.group(1))
        if normalized is not None:
            result.setdefault("totals", {})["withdrawals"] = normalized
            field_confidence["totals.withdrawals"] = 0.78
            logger.debug("Found total_withdrawals=%s", normalized)

    # --- Sanity filters for long numeric strings ---
    for key in list(result.keys()):
        value = result[key]
        if isinstance(value, str) and re.fullmatch(r"\d{6,}", value):
            logger.warning("Filtering out likely invalid numeric value for %s: %s", key, value)
            del result[key]
            field_confidence.pop(key, None)
        elif isinstance(value, dict):
            for nested_key, nested_value in list(value.items()):
                if isinstance(nested_value, str) and re.fullmatch(r"\d{6,}", nested_value):
                    logger.warning(
                        "Filtering out likely invalid numeric value for %s.%s: %s",
                        key,
                        nested_key,
                        nested_value,
                    )
                    del value[nested_key]
                    field_confidence.pop(f"{key}.{nested_key}", None)
            if not value:
                del result[key]

    # --- Validation checks ---
    balance_check_passed = False
    begin_dec = _to_decimal(result.get("beginning_balance"))
    end_dec = _to_decimal(result.get("ending_balance"))
    deposits_dec = _to_decimal(result.get("totals", {}).get("deposits") if isinstance(result.get("totals"), dict) else None)
    withdrawals_dec = _to_decimal(result.get("totals", {}).get("withdrawals") if isinstance(result.get("totals"), dict) else None)

    if None not in (begin_dec, end_dec, deposits_dec, withdrawals_dec):
        expected_end = begin_dec + deposits_dec - withdrawals_dec
        diff = abs(expected_end - end_dec)
        tolerance = Decimal("0.50")
        if diff <= tolerance:
            balance_check_passed = True
            field_confidence["beginning_balance"] = round(
                min(field_confidence.get("beginning_balance", 0.8) + 0.05, 0.95), 2
            )
            field_confidence["ending_balance"] = round(
                min(field_confidence.get("ending_balance", 0.8) + 0.05, 0.95), 2
            )
            if "totals.deposits" in field_confidence:
                field_confidence["totals.deposits"] = round(
                    min(field_confidence["totals.deposits"] + 0.05, 0.95), 2
                )
            if "totals.withdrawals" in field_confidence:
                field_confidence["totals.withdrawals"] = round(
                    min(field_confidence["totals.withdrawals"] + 0.05, 0.95), 2
                )
            logger.debug(
                "Balance validation passed: begin=%s deposits=%s withdrawals=%s ending=%s",
                begin_dec,
                deposits_dec,
                withdrawals_dec,
                end_dec,
            )
        else:
            warnings.append("Balance reconciliation failed validation")
            logger.debug(
                "Balance validation failed (diff=%s): begin=%s deposits=%s withdrawals=%s ending=%s",
                diff,
                begin_dec,
                deposits_dec,
                withdrawals_dec,
                end_dec,
            )

    # --- Validate statement period chronology ---
    period = result.get("statement_period")
    if isinstance(period, dict) and "start" in period and "end" in period:
        try:
            start_date = datetime.fromisoformat(period["start"])
            end_date = datetime.fromisoformat(period["end"])
            if start_date > end_date:
                warnings.append("Statement period start is after end")
                logger.debug("Statement period chronology invalid: %s -> %s", start_date, end_date)
        except ValueError:
            warnings.append("Statement period contains invalid dates")
            logger.debug("Invalid ISO dates in statement period: %s", period)

    # --- Confidence scoring ---
    confidence = 0.35
    if "account_number_last4" in result:
        confidence += 0.08
    if isinstance(period, dict) and "start" in period:
        confidence += 0.1
    if isinstance(period, dict) and "end" in period:
        confidence += 0.1
    if "beginning_balance" in result:
        confidence += 0.08
    if "ending_balance" in result:
        confidence += 0.08
    totals = result.get("totals") if isinstance(result.get("totals"), dict) else {}
    if isinstance(totals, dict) and "deposits" in totals:
        confidence += 0.08
    if isinstance(totals, dict) and "withdrawals" in totals:
        confidence += 0.08
    if balance_check_passed:
        confidence += 0.06
    if warnings:
        confidence = max(confidence - 0.1, 0.2)

    confidence = min(round(confidence, 2), 0.95)

    logger.debug(
        "[Bank_Statements] Extraction completed with fields=%s, confidence=%.2f, warnings=%s",
        list(result.keys()),
        confidence,
        warnings,
    )

    return {
        "fields": result,
        "field_confidence": {k: round(v, 2) for k, v in field_confidence.items()},
        "confidence": confidence,
        "warnings": warnings,
        "log_path": str(LOG_PATH),
    }


__all__ = ["extract"]
