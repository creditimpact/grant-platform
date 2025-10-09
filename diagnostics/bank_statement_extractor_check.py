"""Diagnostics for the Bank_Statements extractor registration and linkage."""

from __future__ import annotations

import json
import logging
import sys
from pathlib import Path
from typing import Any

LOG_DIR = Path("/tmp/session_diagnostics")
LOG_DIR.mkdir(parents=True, exist_ok=True)
LOG_PATH = LOG_DIR / "bank_statement_extractor_check.log"

def _configure_logger() -> logging.Logger:
    logger = logging.getLogger("bank_statement_diagnostics")
    logger.setLevel(logging.DEBUG)
    if not logger.handlers:
        handler = logging.FileHandler(LOG_PATH, mode="w", encoding="utf-8")
        handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
        logger.addHandler(handler)
    logger.propagate = False
    return logger

def _load_catalog(root: Path) -> dict[str, Any]:
    catalog_path = root / "document_library" / "catalog.json"
    with catalog_path.open("r", encoding="utf-8") as handle:
        return json.load(handle)

def _ensure_sys_path(root: Path) -> None:
    analyzer_dir = root / "ai-analyzer"
    for candidate in (root, analyzer_dir):
        if str(candidate) not in sys.path:
            sys.path.insert(0, str(candidate))

def main() -> None:
    root = Path(__file__).resolve().parents[1]
    logger = _configure_logger()
    logger.info("Starting Bank_Statements extractor diagnostics")

    catalog = _load_catalog(root)
    documents = catalog.get("documents", [])
    bank_entry = next((doc for doc in documents if doc.get("key") == "Bank_Statements"), None)

    if not bank_entry:
        logger.error("Bank_Statements entry missing from catalog.json")
    else:
        logger.info("Bank_Statements entry found in catalog.json")
        if not bank_entry.get("extractor"):
            logger.warning("catalog.json missing 'extractor' for Bank_Statements")
        else:
            logger.info("catalog.json extractor set to %s", bank_entry.get("extractor"))

        schema_fields = bank_entry.get("schema_fields")
        if not schema_fields:
            logger.warning("catalog.json missing 'schema_fields' for Bank_Statements")
        else:
            required_fields = {
                "account_number_last4",
                "statement_period.start",
                "statement_period.end",
                "beginning_balance",
                "ending_balance",
                "totals.deposits",
                "totals.withdrawals",
            }
            missing_required = sorted(required_fields.difference(schema_fields))
            if missing_required:
                logger.warning("catalog.json missing required schema fields: %s", missing_required)
            else:
                logger.info("All required schema fields are present in catalog.json")

    extractor_path = root / "ai-analyzer" / "src" / "extractors" / "Bank_Statements.py"
    if extractor_path.exists():
        logger.info("Extractor file located at %s", extractor_path)
    else:
        logger.error("Extractor file missing: %s", extractor_path)
        return

    _ensure_sys_path(root)

    try:
        from importlib import import_module
        module = import_module("src.extractors.Bank_Statements")
        logger.info("Successfully imported %s", module.__name__)
    except Exception as exc:
        logger.exception("Failed to import Bank_Statements extractor: %s", exc)
        return

    extract_fn = getattr(module, "extract", None)
    if not callable(extract_fn):
        logger.error("Bank_Statements.extract is not callable")
    else:
        logger.info("Bank_Statements.extract callable verified")

    pdf_path = root / "document_library" / "2024.11.30.Paulsson.Checking.4156.pdf"
    if not pdf_path.exists():
        logger.warning("Test PDF not found: %s", pdf_path)
        return

    try:
        from ai_analyzer.ocr_utils import extract_text as ocr_extract_text
        from src.detectors import detect
        from src.normalization import normalize_doc_type
    except Exception as exc:
        logger.exception("Failed to import runtime helpers: %s", exc)
        return

    file_bytes = pdf_path.read_bytes()
    text = ocr_extract_text(file_bytes)
    if not text:
        logger.warning("OCR extraction returned no text for %s", pdf_path.name)
        return

    detection = detect(text, filename=pdf_path.name)
    type_info = detection.get("type", {})
    normalized_type = normalize_doc_type(type_info.get("key"))
    logger.info(
        "Detector output -> key=%s, normalized=%s, confidence=%s",
        type_info.get("key"),
        normalized_type,
        type_info.get("confidence"),
    )

    if normalized_type != "Bank_Statements":
        logger.warning("Unexpected normalized type %s (expected Bank_Statements)", normalized_type)

    if callable(extract_fn):
        result = extract_fn(text)
        if isinstance(result, dict):
            logger.info("Extractor returned %d keys: %s", len(result.keys()), sorted(result.keys()))
        else:
            logger.warning("Extractor returned non-dict payload: %s", type(result))

if __name__ == "__main__":
    main()
