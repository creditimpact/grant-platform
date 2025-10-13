# Structured OCR and Analyzer Artifacts

This document describes the developer contract for the structured OCR payload
(`ocr_output.json`) and the unified analyzer response (`analyzer_output.json`).
Both files are emitted for every analysis session and are stored under
`tmp/sessions/<session_id>/`.

## OCR Artifact (`ocr_output.json`)

* Always produced, even when the input is plain text.
* Contains one entry per page. Each line item has:
  * `line_index` — Stable, zero-based index scoped to the page.
  * `text` — Raw text content.
  * Optional metadata such as `bbox`, `font_size`, and `confidence`.
* `page_text` aggregates the page lines. `text` aggregates all pages.
* `engine` and `engine_version` capture the primary OCR backend that produced
  the payload (`pdfminer`, `pdfplumber`, `tesseract`, or `raw`).
* `character_count` equals the length of the `text` field.

## Analyzer Artifact (`analyzer_output.json`)

* Captures detector and extractor metadata alongside the extracted fields.
* `fields` contains provenance-aware objects: each leaf is a dictionary with at
  least `value` and `provenance` keys (confidence is included when available).
  Provenance defaults to an empty list until extractors populate it.
* `fields_clean` is the normalized representation used by downstream clients.
* `debug` bundles the raw detector payload, catalog snapshot, and any
  user-facing errors encountered during the run.
* `raw_text_preview` mirrors the legacy preview string and is always truncated
  to 512 characters.

## Backward Compatibility

* The FastAPI response still exposes the legacy `fields.json` payload.
* `ocr_output.json` keeps a `raw_text` key for older tooling; new clients should
  rely on `page_text` instead.
* The helper `SessionManager.save_json` persists both artifacts without
  mutation. Downstream services must treat the files as read-only records.

## Testing Tips

* `tests/test_analyzer_output_artifact.py` exercises the end-to-end flow and
  asserts that both artifacts are written.
* Schema definitions live under `schemas/` to assist with validation tooling.
