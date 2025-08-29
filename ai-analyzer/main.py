from fastapi import FastAPI, UploadFile, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.concurrency import run_in_threadpool
import sys
from pathlib import Path
from typing import Any
import io
import cgi
import json
import time
from pydantic import BaseModel, constr
from ai_analyzer.ocr_utils import extract_text, OCRExtractionError
from ai_analyzer.nlp_parser import extract_fields, normalize_text
from ai_analyzer.config import settings  # type: ignore
from ai_analyzer.upload_utils import validate_upload
from src.detectors import identify
from src.extractors.irs_1120x import extract as extract_1120x
from src.extractors.tax_payment_receipt import extract as extract_tax_payment_receipt
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
    return {"text": text}


class TextAnalyzeRequest(BaseModel):
    text: constr(
        strip_whitespace=True,
        min_length=1,
        max_length=settings.MAX_TEXT_LEN,
    )


@app.post("/analyze")
async def analyze(request: Request):
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
        return await analyze_text_flow(req.text, source="text")

    if "text/plain" in ctype:
        raw = await request.body()
        if len(raw) > settings.MAX_TEXT_LEN:
            raise HTTPException(status_code=400, detail="Text exceeds limit")
        body_text = raw.decode("utf-8", errors="replace").strip()
        if not body_text:
            raise HTTPException(status_code=400, detail="Provide file or text")
        return await analyze_text_flow(body_text, source="text")

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
            return await analyze_text_flow(text_val.strip(), source="text")
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
        return await analyze_text_flow(
            extracted,
            source="file",
            filename=filename,
            content_type=content_type_file,
        )

    raise HTTPException(status_code=400, detail="Unsupported Content-Type")


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


async def analyze_text_flow(
    text: str,
    *,
    source: str,
    filename: str | None = None,
    content_type: str | None = None,
) -> dict:
    normalized = normalize_text(text)
    fields, confidence, ambiguities = extract_fields(
        normalized, enable_secondary=settings.ENABLE_SECONDARY_FIELDS
    )
    response: dict[str, Any] = {
        "ein": fields.get("ein"),
        "w2_employee_count": fields.get("w2_employee_count"),
        "quarterly_revenues": fields.get("quarterly_revenues", {}),
        "entity_type": fields.get("entity_type"),
        "year_founded": fields.get("year_founded")
        if settings.ENABLE_SECONDARY_FIELDS
        else None,
        "annual_revenue": fields.get("annual_revenue")
        if settings.ENABLE_SECONDARY_FIELDS
        else None,
        "location_state": fields.get("location_state")
        if settings.ENABLE_SECONDARY_FIELDS
        else None,
        "location_country": fields.get("location_country")
        if settings.ENABLE_SECONDARY_FIELDS
        else None,
        "minority_owned": fields.get("minority_owned")
        if settings.ENABLE_SECONDARY_FIELDS
        else None,
        "female_owned": fields.get("female_owned")
        if settings.ENABLE_SECONDARY_FIELDS
        else None,
        "veteran_owned": fields.get("veteran_owned")
        if settings.ENABLE_SECONDARY_FIELDS
        else None,
        "ppp_reference": fields.get("ppp_reference")
        if settings.ENABLE_SECONDARY_FIELDS
        else None,
        "ertc_reference": fields.get("ertc_reference")
        if settings.ENABLE_SECONDARY_FIELDS
        else None,
        "confidence": confidence,
        "ambiguities": ambiguities,
        "raw_text_preview": normalized[:2000],
        "source": source,
    }
    det = identify(text)
    response["doc_type"] = det.get("type_key")
    response["doc_confidence"] = det.get("confidence", 0)
    if det.get("type_key") == "Form_1120X":
        response["fields"] = extract_1120x(text)
    elif det.get("type_key") == "Tax_Payment_Receipt":
        response["fields"] = extract_tax_payment_receipt(text)
    extra = {"source": source}
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
