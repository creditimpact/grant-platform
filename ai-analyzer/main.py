import sys
import os

sys.path.append(
    os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
)

from fastapi import FastAPI, UploadFile, HTTPException, Request, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.concurrency import run_in_threadpool
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
import io
import cgi
import json
import time
from pydantic import BaseModel, constr
from ai_analyzer.ocr_utils import extract_text, OCRExtractionError
from importlib import import_module

from ai_analyzer.nlp_parser import extract_fields as extract_generic_fields, normalize_text
from ai_analyzer.config import settings  # type: ignore
from ai_analyzer.upload_utils import validate_upload
from document_library import catalog_index
from src.detectors import detect
from src.normalization import normalize_doc_type
from src.session_manager import SessionManager
try:  # pragma: no cover - optional OpenAI dependency
    from openai import OpenAI  # type: ignore
    openai_client = (
        OpenAI(api_key=settings.OPENAI_API_KEY)
        if settings.OPENAI_API_KEY
        else None
    )
except Exception:  # pragma: no cover - legacy or missing libs
    try:
        import openai  # type: ignore
        if settings.OPENAI_API_KEY:
            openai.api_key = settings.OPENAI_API_KEY

            class _LegacyClient:
                chat = type(
                    "Chat",
                    (),
                    {
                        "completions": type(
                            "Comp",
                            (),
                            {
                                "create": staticmethod(
                                    openai.ChatCompletion.create
                                )
                            },
                        )
                    },
                )

            openai_client = _LegacyClient()  # type: ignore
        else:
            openai_client = None
    except Exception:  # pragma: no cover
        openai_client = None

try:  # pragma: no cover - external dependency may be missing
    import pytesseract  # type: ignore
    from PIL import Image  # type: ignore
    if settings.TESSERACT_CMD:
        pytesseract.pytesseract.tesseract_cmd = settings.TESSERACT_CMD
except Exception:  # pragma: no cover - gracefully handle missing libs
    pytesseract = None  # type: ignore
    Image = None  # type: ignore

CURRENT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(CURRENT_DIR.parent))
from common.logger import get_logger  # noqa: E402
from common.request_id import request_id_middleware  # noqa: E402

logger = get_logger(__name__)

app = FastAPI(title="AI Analyzer")
try:
    app.middleware("http")(request_id_middleware)
except AttributeError:
    pass

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(HTTPException)
async def http_exception_handler(
    _: Request, exc: HTTPException
) -> JSONResponse:
    detail = exc.detail
    if isinstance(detail, dict):
        content = detail
    else:
        content = {"error": detail}
    return JSONResponse(status_code=exc.status_code, content=content)


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/readyz")
def readyz() -> JSONResponse:
    return JSONResponse(status_code=200, content={"status": "ready"})


@app.get("/")
def root() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/status")
def status() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/ocr-image")
async def ocr_image(request: Request) -> dict[str, str]:
    if not pytesseract or not Image:
        raise HTTPException(
            status_code=500, detail="Tesseract OCR not available"
        )

    ctype = request.headers.get("content-type", "")
    if "multipart/form-data" not in ctype:
        raise HTTPException(status_code=400, detail="Unsupported Content-Type")

    body = await request.body()
    env = {
        "REQUEST_METHOD": "POST",
        "CONTENT_TYPE": ctype,
        "CONTENT_LENGTH": str(len(body)),
    }
    form = cgi.FieldStorage(
        fp=io.BytesIO(body), environ=env, keep_blank_values=True
    )
    field = form["file"] if "file" in form else None
    if field is None or not getattr(field, "filename", None):
        raise HTTPException(status_code=400, detail="Provide file or text")

    filename = field.filename
    file_bytes = field.file.read()
    upload = UploadFile(io.BytesIO(file_bytes), filename=filename)
    validate_upload(upload)
    try:
        text = extract_text(file_bytes)
    except OCRExtractionError as exc:
        logger.exception("ocr_image failed")
        raise HTTPException(
            status_code=500, detail="Failed to extract text"
        ) from exc
    decoded = file_bytes.decode("utf-8", errors="ignore").strip()
    if not text.strip() or text.strip() == decoded:
        raise HTTPException(status_code=500, detail="Failed to extract text")
    return {"text": text}


class TextAnalyzeRequest(BaseModel):
    text: constr(
        strip_whitespace=True,
        min_length=1,
        max_length=settings.MAX_TEXT_LEN,
    )


@app.post("/analyze")
async def analyze(
    request: Request,
    file: UploadFile | None = File(None),
    text: str | None = Form(None),
):
    if text is not None:
        form_text = text.strip()
        if form_text:
            if len(form_text.encode("utf-8")) > settings.MAX_TEXT_LEN:
                raise HTTPException(status_code=400, detail="Text exceeds limit")
            session_id = SessionManager.create_session()
            analysis_result, _ = await run_analysis_session(
                session_id=session_id,
                source="text",
                text_input=form_text,
                upload_bytes=None,
                filename=None,
                content_type=None,
                raise_on_fail=True,
            )
            return analysis_result or {}
        if file is None:
            raise HTTPException(status_code=400, detail="Provide file or text")

    if file is not None:
        validate_upload(file)
        upload_bytes = await file.read()
        session_id = SessionManager.create_session()
        analysis_result, _ = await run_analysis_session(
            session_id=session_id,
            source="file",
            text_input=None,
            upload_bytes=upload_bytes,
            filename=file.filename,
            content_type=file.content_type,
            raise_on_fail=True,
        )
        return analysis_result or {}

    ctype = request.headers.get("content-type", "")

    if "application/json" in ctype:
        try:
            payload = await request.json()
        except Exception as exc:  # pragma: no cover
            # FastAPI handles body parsing
            raise HTTPException(
                status_code=422, detail="Invalid JSON"
            ) from exc
        try:
            req = TextAnalyzeRequest(**payload)
        except Exception as exc:
            raise HTTPException(
                status_code=422, detail="Invalid JSON shape"
            ) from exc
        session_id = SessionManager.create_session()
        analysis_result, _ = await run_analysis_session(
            session_id=session_id,
            source="text",
            text_input=req.text,
            upload_bytes=None,
            filename=None,
            content_type="application/json",
            raise_on_fail=True,
        )
        return analysis_result or {}

    if "text/plain" in ctype:
        raw = await request.body()
        if len(raw) > settings.MAX_TEXT_LEN:
            raise HTTPException(status_code=400, detail="Text exceeds limit")
        body_text = raw.decode("utf-8", errors="replace").strip()
        if not body_text:
            raise HTTPException(status_code=400, detail="Provide file or text")
        session_id = SessionManager.create_session()
        analysis_result, _ = await run_analysis_session(
            session_id=session_id,
            source="text",
            text_input=body_text,
            upload_bytes=None,
            filename=None,
            content_type="text/plain",
            raise_on_fail=True,
        )
        return analysis_result or {}

    raise HTTPException(status_code=400, detail="Unsupported Content-Type")


@app.post("/diagnose")
async def diagnose(
    request: Request,
    file: UploadFile | None = File(None),
    text: str | None = Form(None),
):
    session_id = SessionManager.create_session()
    errors: list[str] = []
    upload_bytes: bytes | None = None
    filename: str | None = None
    content_type: str | None = None
    text_input: str | None = None

    if text is not None:
        form_text = text.strip()
        if form_text:
            if len(form_text.encode("utf-8")) > settings.MAX_TEXT_LEN:
                errors.append("Text exceeds allowed limit; ignoring text input.")
            else:
                text_input = form_text
        else:
            errors.append("Text form field was provided but empty.")

    if file is not None:
        try:
            validate_upload(file)
            upload_bytes = await file.read()
            if not upload_bytes:
                errors.append("Uploaded file was empty.")
            else:
                filename = file.filename
                content_type = file.content_type
        except HTTPException as exc:
            errors.append(f"Upload validation failed: {exc.detail}")
        except Exception as exc:  # pragma: no cover - unexpected validation errors
            logger.exception("diagnose upload validation failed", extra={"session_id": session_id})
            errors.append(f"Upload validation error: {exc}")

    if text_input is None and upload_bytes is None:
        ctype = request.headers.get("content-type", "")
        if "application/json" in ctype:
            try:
                payload = await request.json()
                req = TextAnalyzeRequest(**payload)
                text_input = req.text
            except Exception as exc:
                errors.append(f"Invalid JSON payload: {exc}")
        elif "text/plain" in ctype:
            raw = await request.body()
            if len(raw) > settings.MAX_TEXT_LEN:
                errors.append("Text exceeds allowed limit; ignoring text input.")
            else:
                body_text = raw.decode("utf-8", errors="replace").strip()
                if body_text:
                    text_input = body_text
                else:
                    errors.append("Plain text body was empty.")
        elif "multipart/form-data" in ctype:
            errors.append("Multipart request missing file or text payload.")

    if upload_bytes is not None and text_input:
        errors.append("Both file and text provided; prioritizing file for analysis.")
        text_input = None

    source = "file" if upload_bytes else "text"

    _, report = await run_analysis_session(
        session_id=session_id,
        source=source,
        text_input=text_input,
        upload_bytes=upload_bytes,
        filename=filename,
        content_type=content_type,
        raise_on_fail=False,
        initial_errors=errors,
    )

    return report


@app.post("/analyze-ai")
async def analyze_ai(request: Request):
    if not settings.USE_AI_ANALYZER:
        raise HTTPException(status_code=503, detail="AI analyzer disabled")
    ctype = request.headers.get("content-type", "")

    if "application/json" in ctype:
        try:
            payload = await request.json()
        except Exception as exc:  # pragma: no cover
            raise HTTPException(
                status_code=422, detail="Invalid JSON"
            ) from exc
        try:
            req = TextAnalyzeRequest(**payload)
        except Exception as exc:
            raise HTTPException(
                status_code=422, detail="Invalid JSON shape"
            ) from exc
        return await analyze_ai_text_flow(req.text, source="text")

    if "text/plain" in ctype:
        raw = await request.body()
        if len(raw) > settings.MAX_TEXT_LEN:
            raise HTTPException(status_code=400, detail="Text exceeds limit")
        body_text = raw.decode("utf-8", errors="replace").strip()
        if not body_text:
            raise HTTPException(status_code=400, detail="Provide file or text")
        return await analyze_ai_text_flow(body_text, source="text")

    if "multipart/form-data" in ctype:
        body = await request.body()
        env = {
            "REQUEST_METHOD": "POST",
            "CONTENT_TYPE": ctype,
            "CONTENT_LENGTH": str(len(body)),
        }
        form = cgi.FieldStorage(
            fp=io.BytesIO(body), environ=env, keep_blank_values=True
        )
        text_val = None
        upload_bytes = None
        filename = None
        content_type_file = None
        if "text" in form and not getattr(form["text"], "filename", None):
            text_val = form["text"].value
        if "file" in form:
            field = form["file"]
            if getattr(field, "filename", None):
                filename = field.filename
                content_type_file = field.type
                upload_bytes = field.file.read()
        if text_val and text_val.strip():
            if len(text_val.encode("utf-8")) > settings.MAX_TEXT_LEN:
                raise HTTPException(
                    status_code=400, detail="Text exceeds limit"
                )
            return await analyze_ai_text_flow(text_val.strip(), source="text")
        if upload_bytes is None:
            raise HTTPException(status_code=400, detail="Provide file or text")
        upload = UploadFile(io.BytesIO(upload_bytes), filename=filename)
        validate_upload(upload)
        try:
            extracted = extract_text(upload_bytes)
        except OCRExtractionError as exc:
            logger.exception("extract_text failed")
            raise HTTPException(
                status_code=500, detail="Failed to extract text"
            ) from exc
        return await analyze_ai_text_flow(
            extracted,
            source="file",
            filename=filename,
            content_type=content_type_file,
        )

    raise HTTPException(status_code=400, detail="Unsupported Content-Type")


def _catalog_definition(doc_type: str | None) -> Any:
    if not doc_type:
        return None
    return catalog_index().get(doc_type)


def _get_nested_value(payload: Any, path: str) -> Any:
    if not isinstance(payload, dict):
        return None
    parts = path.split(".")
    current: Any = payload
    for part in parts:
        if not isinstance(current, dict) or part not in current:
            return None
        current = current[part]
    return current


def _set_nested_value(target: dict, path: str, value: Any) -> None:
    parts = path.split(".")
    cursor = target
    for part in parts[:-1]:
        cursor = cursor.setdefault(part, {})
    cursor[parts[-1]] = value


def _iter_field_paths(payload: Any, prefix: str = "") -> list[str]:
    if not isinstance(payload, dict):
        return []
    paths: list[str] = []
    for key, value in payload.items():
        path = f"{prefix}.{key}" if prefix else str(key)
        if isinstance(value, dict):
            paths.extend(_iter_field_paths(value, path))
        else:
            paths.append(path)
    return paths


def _filter_schema_fields(
    extracted: dict[str, Any], schema_fields: list[str]
) -> tuple[dict[str, Any], list[str]]:
    filtered: dict[str, Any] = {}
    schema_set = set(schema_fields)
    skipped: list[str] = []

    for field in schema_fields:
        value = _get_nested_value(extracted, field)
        if value is not None:
            _set_nested_value(filtered, field, value)

    for path in _iter_field_paths(extracted):
        if path not in schema_set:
            skipped.append(path)

    return filtered, skipped


def _import_extractor(doc_type: str):
    try:
        return import_module(f"src.extractors.{doc_type}")
    except ModuleNotFoundError:
        return None


async def analyze_text_flow(
    text: str,
    *,
    source: str,
    filename: str | None = None,
    content_type: str | None = None,
    session_id: str | None = None,
) -> dict:
    normalized = normalize_text(text)
    detection = detect(text, filename=filename)
    type_info = detection.get("type", {})
    normalized_type = normalize_doc_type(type_info.get("key"))
    confidence = float(type_info.get("confidence", 0.0) or 0.0)

    response: dict[str, Any] = {
        "doc_type": normalized_type or "untyped",
        "doc_confidence": confidence,
        "schema_fields": [],
        "fields": {},
        "confidence": confidence,
        "raw_text_preview": normalized[:2000],
        "source": source,
    }

    extractor_name: str | None = None
    skipped_fields: list[str] = []
    schema_fields: list[str] = []

    detected_label = normalized_type or type_info.get("key") or "unknown"
    logger.debug(
        "[DEBUG] Detected doc_type=%s (confidence=%s)",
        detected_label,
        confidence,
    )

    if normalized_type and confidence >= 0.6:
        definition = _catalog_definition(normalized_type)
        if definition:
            schema_fields = list(definition.schema_fields)
            schema_field_set = set(schema_fields)
            extractor_module = _import_extractor(normalized_type)
            if extractor_module and hasattr(extractor_module, "extract"):
                logger.debug(
                    "[DEBUG] Extractor import resolved: %s",
                    extractor_module.__name__,
                )
                extractor_name = f"{extractor_module.__name__}.extract"
                extracted_payload = extractor_module.extract(text)
                raw_fields: dict[str, Any] | None = None
                field_confidence_map: dict[str, float] = {}
                extractor_confidence: float | None = None
                payload_warnings: list[str] = []

                if isinstance(extracted_payload, dict):
                    candidate_fields = extracted_payload.get("fields")
                    if isinstance(candidate_fields, dict):
                        raw_fields = candidate_fields
                    elif all(
                        isinstance(key, str) for key in extracted_payload.keys()
                    ):
                        raw_fields = extracted_payload  # backward compatibility

                    candidate_conf = extracted_payload.get("field_confidence")
                    if isinstance(candidate_conf, dict):
                        field_confidence_map = {
                            str(k): float(v)
                            for k, v in candidate_conf.items()
                            if isinstance(v, (int, float))
                        }

                    if "confidence" in extracted_payload:
                        try:
                            extractor_confidence = float(
                                extracted_payload.get("confidence") or 0.0
                            )
                        except (TypeError, ValueError):
                            extractor_confidence = None

                    candidate_warnings = extracted_payload.get("warnings")
                    if isinstance(candidate_warnings, list):
                        payload_warnings = [str(item) for item in candidate_warnings]

                if raw_fields is None and isinstance(extracted_payload, dict):
                    raw_fields = {
                        k: v
                        for k, v in extracted_payload.items()
                        if isinstance(k, str)
                    }
                elif raw_fields is None:
                    raw_fields = extracted_payload if isinstance(extracted_payload, dict) else {}

                extracted_keys = (
                    sorted(raw_fields.keys()) if isinstance(raw_fields, dict) else None
                )
                logger.debug(
                    "[DEBUG] Extractor returned fields: %s",
                    extracted_keys,
                )
                filtered, skipped_fields = _filter_schema_fields(
                    raw_fields or {}, schema_fields
                )
                response["fields"] = filtered
                response["field_confidence"] = {
                    key: field_confidence_map[key]
                    for key in sorted(field_confidence_map.keys())
                    if key in schema_field_set
                }
                if extractor_confidence is not None:
                    response["extractor_confidence"] = extractor_confidence
                if payload_warnings:
                    response.setdefault("warnings", []).extend(payload_warnings)
            else:
                logger.debug(
                    "[DEBUG] Extractor import resolved: %s",
                    None,
                )
                skipped_fields.append("__missing_extractor__")
        else:
            skipped_fields.append("__missing_schema__")
        response["schema_fields"] = schema_fields
    else:
        (
            generic_fields,
            generic_confidence_map,
            ambiguities,
        ) = extract_generic_fields(
            normalized, enable_secondary=settings.ENABLE_SECONDARY_FIELDS
        )
        response["doc_type"] = "untyped"
        response["schema_fields"] = sorted(generic_fields.keys())
        response["fields"] = generic_fields
        response["ambiguities"] = ambiguities
        response["field_confidence"] = generic_confidence_map

    debug_payload = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "detected_type": type_info.get("key"),
        "normalized_type": normalized_type,
        "confidence": confidence,
        "schema_fields": schema_fields,
        "skipped_fields": skipped_fields,
        "extractor": extractor_name,
        "used_fallback": response["doc_type"] == "untyped",
    }

    try:
        base = Path("/tmp/sessions")
        base.mkdir(parents=True, exist_ok=True)
        folder = base / (session_id or datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S_%f"))
        folder.mkdir(parents=True, exist_ok=True)
        with (folder / "analyzer_debug.json").open("w", encoding="utf-8") as fh:
            json.dump(debug_payload, fh, ensure_ascii=False, indent=2)
    except Exception:  # pragma: no cover - diagnostics should not break flow
        logger.exception("failed to write analyzer debug trace")

    extra = {"source": source, "doc_type": response["doc_type"], "confidence": confidence}
    if filename:
        extra["upload_filename"] = filename
    if content_type:
        extra["content_type"] = content_type
    logger.info("analyze", extra=extra)
    return response


EXPECTED_FIELDS = [
    "ein",
    "w2_employee_count",
    "quarterly_revenues",
    "entity_type",
    "year_founded",
    "annual_revenue",
    "location_state",
    "location_country",
    "minority_owned",
    "female_owned",
    "veteran_owned",
    "ppp_reference",
    "ertc_reference",
]


def _sanitize_filename(name: str | None) -> str:
    if not name:
        return "upload.bin"
    return Path(name).name or "upload.bin"


def _build_diagnostic_report(
    *,
    session_id: str,
    start_time: datetime,
    end_time: datetime,
    source: str,
    file_info: dict[str, Any],
    ocr_status: str,
    ocr_text: str,
    detect_result: dict | None,
    analysis_result: dict | None,
    catalog_entries: int | None,
    matched_rule: str | None,
    errors: list[str],
) -> dict[str, Any]:
    duration = (end_time - start_time).total_seconds()
    doc_type = None
    doc_confidence = None
    if detect_result:
        det_type = detect_result.get("type", {})
        doc_type = det_type.get("key")
        doc_confidence = det_type.get("confidence")

    analyzer_fields: dict[str, Any] = {}
    if analysis_result:
        if isinstance(analysis_result.get("fields_clean"), dict):
            analyzer_fields = analysis_result["fields_clean"]  # type: ignore[index]
        elif isinstance(analysis_result.get("fields"), dict):
            analyzer_fields = analysis_result["fields"]  # type: ignore[index]

    example_field = None
    if analyzer_fields:
        for key, value in analyzer_fields.items():
            example_field = {key: value}
            break

    report = {
        "session_id": session_id,
        "started_at": start_time.isoformat(),
        "completed_at": end_time.isoformat(),
        "duration_seconds": duration,
        "source": source,
        "file": file_info,
        "ocr": {
            "status": ocr_status,
            "character_count": len(ocr_text),
            "sample_text": ocr_text[:500],
        },
        "detector": {
            "doc_type": doc_type,
            "confidence": doc_confidence,
        },
        "analyzer": {
            "field_count": len(analyzer_fields),
            "example_field": example_field,
        },
        "catalog": {
            "entries": catalog_entries,
            "matched_rule": matched_rule,
        },
        "errors": list(errors),
        "debug_path": str(SessionManager.get_session_path(session_id)),
    }
    if analysis_result:
        report["analyzer"].update(
            {
                "confidence": analysis_result.get("confidence"),
                "source": analysis_result.get("source"),
            }
        )
    return report


async def run_analysis_session(
    *,
    session_id: str,
    source: str,
    text_input: str | None,
    upload_bytes: bytes | None,
    filename: str | None,
    content_type: str | None,
    raise_on_fail: bool,
    initial_errors: list[str] | None = None,
) -> tuple[dict[str, Any] | None, dict[str, Any]]:
    start_time = datetime.now(timezone.utc)
    errors: list[str] = list(initial_errors or [])
    ocr_text = ""
    ocr_status = "not_run"
    detect_result: dict | None = None
    analysis_result: dict[str, Any] | None = None
    catalog_entries: int | None = None
    matched_rule: str | None = None
    file_info: dict[str, Any] = {
        "name": _sanitize_filename(filename) if filename else None,
        "size": None,
        "content_type": content_type,
    }
    pending_http_exc: HTTPException | None = None
    pending_exc: Exception | None = None

    try:
        if upload_bytes is not None:
            file_info["name"] = _sanitize_filename(filename)
            file_info["size"] = len(upload_bytes)
            if len(upload_bytes) == 0:
                errors.append("Uploaded file was empty")
                if raise_on_fail:
                    raise HTTPException(status_code=400, detail="Provide file or text")
            try:
                SessionManager.save_bytes(
                    session_id, "raw", file_info["name"] or "upload.bin", upload_bytes
                )
            except Exception as exc:  # pragma: no cover - filesystem edge
                logger.exception("Failed to save raw upload", extra={"session_id": session_id})
                errors.append(f"Failed to save raw upload: {exc}")
        elif text_input is not None:
            file_info["size"] = len(text_input.encode("utf-8"))
            try:
                SessionManager.save_text(session_id, "raw", "input_text.txt", text_input)
            except Exception as exc:  # pragma: no cover - filesystem edge
                logger.exception("Failed to save raw text", extra={"session_id": session_id})
                errors.append(f"Failed to save raw text: {exc}")

        if upload_bytes is not None and len(upload_bytes) > 0:
            try:
                ocr_text = extract_text(upload_bytes)
                ocr_status = "success"
                if not ocr_text.strip():
                    errors.append("OCR returned no text from upload.")
                    ocr_status = "empty"
                    if raise_on_fail:
                        raise HTTPException(
                            status_code=500, detail="Failed to extract text"
                        )
                elif upload_bytes.lstrip().startswith(b"%PDF") and ocr_text.strip().startswith("%PDF"):
                    errors.append("OCR returned raw PDF header; treating as failure.")
                    ocr_status = "error"
                    if raise_on_fail:
                        raise HTTPException(
                            status_code=500, detail="Failed to extract text"
                        )
                    ocr_text = ""
                else:
                    raw_decoded = upload_bytes.decode("utf-8", errors="ignore").strip()
                    if (
                        ocr_text.strip() == raw_decoded
                        and content_type
                        and not content_type.startswith("text/")
                    ):
                        errors.append(
                            "OCR fell back to raw byte decode; treating as failure."
                        )
                        ocr_status = "error"
                        if raise_on_fail:
                            raise HTTPException(
                                status_code=500, detail="Failed to extract text"
                            )
                        ocr_text = ""
            except OCRExtractionError as exc:
                ocr_status = "error"
                logger.exception("extract_text failed", extra={"session_id": session_id})
                errors.append(f"OCR extraction failed: {exc}")
                if raise_on_fail:
                    raise HTTPException(status_code=500, detail="Failed to extract text") from exc
            except Exception as exc:  # pragma: no cover - unexpected OCR errors
                ocr_status = "error"
                logger.exception("Unexpected OCR failure", extra={"session_id": session_id})
                errors.append(f"Unexpected OCR failure: {exc}")
                if raise_on_fail:
                    raise HTTPException(status_code=500, detail="Failed to extract text") from exc
        elif text_input is not None:
            ocr_text = text_input
            ocr_status = "provided"
        else:
            if not raise_on_fail:
                errors.append("No text available for analysis")
            else:
                raise HTTPException(status_code=400, detail="Provide file or text")

        if ocr_text:
            try:
                SessionManager.save_text(session_id, "ocr", "ocr_output.txt", ocr_text)
            except Exception as exc:  # pragma: no cover - filesystem edge
                logger.exception("Failed to save OCR text", extra={"session_id": session_id})
                errors.append(f"Failed to save OCR text: {exc}")

        if ocr_text:
            try:
                detect_result = detect(ocr_text, filename=filename)
                matched_rule = detect_result.get("type", {}).get("key")
                SessionManager.save_json(
                    session_id, "detect", "detect_result.json", detect_result
                )
            except Exception as exc:  # pragma: no cover - detector errors
                logger.exception("Detector failed", extra={"session_id": session_id})
                errors.append(f"Detector failed: {exc}")
                if raise_on_fail:
                    raise

        if ocr_text and (detect_result or not raise_on_fail):
            try:
                analysis_result = await analyze_text_flow(
                    ocr_text,
                    source=source,
                    filename=filename,
                    content_type=content_type,
                    session_id=session_id,
                )
                SessionManager.save_json(
                    session_id, "analyze", "fields.json", analysis_result
                )
            except Exception as exc:  # pragma: no cover - analyzer errors
                logger.exception("Analyzer failed", extra={"session_id": session_id})
                errors.append(f"Analyzer failed: {exc}")
                if raise_on_fail:
                    raise

        try:
            catalog_path = (
                Path(__file__).resolve().parents[1] / "document_library" / "catalog.json"
            )
            catalog_snapshot = json.loads(catalog_path.read_text(encoding="utf-8"))
            catalog_entries = len(catalog_snapshot.get("documents", []))
            SessionManager.save_json(
                session_id, "catalog", "catalog_snapshot.json", catalog_snapshot
            )
        except Exception as exc:  # pragma: no cover - filesystem edge
            logger.exception("Failed to snapshot catalog", extra={"session_id": session_id})
            errors.append(f"Failed to snapshot catalog: {exc}")

    except HTTPException as exc:
        if raise_on_fail:
            pending_http_exc = exc
        else:
            errors.append(f"HTTP error: {exc.detail}")
    except Exception as exc:  # pragma: no cover - unexpected fallthrough
        logger.exception("Unexpected analysis failure", extra={"session_id": session_id})
        if raise_on_fail:
            pending_exc = exc
        else:
            errors.append(f"Unexpected failure: {exc}")
    finally:
        end_time = datetime.now(timezone.utc)
        report = _build_diagnostic_report(
            session_id=session_id,
            start_time=start_time,
            end_time=end_time,
            source=source,
            file_info=file_info,
            ocr_status=ocr_status,
            ocr_text=ocr_text,
            detect_result=detect_result,
            analysis_result=analysis_result,
            catalog_entries=catalog_entries,
            matched_rule=matched_rule,
            errors=errors,
        )
        try:
            SessionManager.save_json(
                session_id, "report", "diagnostic_report.json", report
            )
        except Exception as exc:  # pragma: no cover - filesystem edge
            logger.exception("Failed to save diagnostic report", extra={"session_id": session_id})
            errors.append(f"Failed to save diagnostic report: {exc}")
            report["errors"] = list(errors)

    if pending_http_exc is not None:
        raise pending_http_exc
    if pending_exc is not None:
        raise pending_exc

    return analysis_result, report


async def call_openai_structured(text: str) -> dict[str, Any]:
    if not openai_client:
        raise HTTPException(status_code=500, detail="OpenAI not configured")
    system_prompt = (
        "Extract structured business fields from the user's text. "
        "Always return a JSON object with the keys: ein, w2_employee_count, "
        "quarterly_revenues, entity_type, year_founded, annual_revenue, "
        "location_state, location_country, minority_owned, female_owned, "
        "veteran_owned, ppp_reference, ertc_reference. Use null for unknown."
    )
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": text},
    ]
    last_exc: Exception | None = None
    for _ in range(3):
        try:
            resp = await run_in_threadpool(
                lambda: openai_client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=messages,
                    response_format={"type": "json_object"},
                    timeout=15,
                )
            )
            return json.loads(resp.choices[0].message.content)
        except TypeError:  # older openai versions
            resp = await run_in_threadpool(
                lambda: openai_client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=messages,
                    timeout=15,
                )
            )
            return json.loads(resp.choices[0].message.content)
        except Exception as exc:  # pragma: no cover
            last_exc = exc
            time.sleep(1)
    logger.exception("openai call failed")
    raise HTTPException(
        status_code=500, detail="Failed to extract using AI"
    ) from last_exc


async def analyze_ai_text_flow(
    text: str,
    *,
    source: str,
    filename: str | None = None,
    content_type: str | None = None,
) -> dict[str, Any]:
    structured = await call_openai_structured(text)
    structured.setdefault("quarterly_revenues", {})
    for q in ["Q1", "Q2", "Q3", "Q4"]:
        structured["quarterly_revenues"].setdefault(q, None)
    for key in EXPECTED_FIELDS:
        if key != "quarterly_revenues":
            structured.setdefault(key, None)
    structured["raw_text_preview"] = text[:2000]
    structured["source"] = source
    extra = {"source": source}
    if filename:
        extra["upload_filename"] = filename
    if content_type:
        extra["content_type"] = content_type
    logger.info("analyze_ai", extra=extra)
    return structured

if __name__ == "__main__":
    import uvicorn
    import ssl

    cert = str(settings.TLS_CERT_PATH)
    key = str(settings.TLS_KEY_PATH)
    ca = str(settings.TLS_CA_PATH) if settings.TLS_CA_PATH else None
    kwargs: dict[str, object] = {}
    if cert and key:
        kwargs = {"ssl_certfile": cert, "ssl_keyfile": key}
        if ca:
            kwargs["ssl_ca_certs"] = ca
            kwargs["ssl_cert_reqs"] = ssl.CERT_REQUIRED
    uvicorn.run(app, host="0.0.0.0", port=8000, **kwargs)
