from fastapi import FastAPI, File, UploadFile, HTTPException, Request, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import sys
from pathlib import Path
from typing import Optional
import io
from pydantic import BaseModel, constr
from ocr_utils import extract_text
from nlp_parser import extract_fields, normalize_text
from config import settings  # type: ignore

try:  # pragma: no cover - external dependency may be missing
    import pytesseract  # type: ignore
    from PIL import Image  # type: ignore
    pytesseract.pytesseract.tesseract_cmd = r"C:\\Program Files\\Tesseract-OCR\\tesseract.exe"
except Exception:  # pragma: no cover - gracefully handle missing libs
    pytesseract = None  # type: ignore
    Image = None  # type: ignore

CURRENT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(CURRENT_DIR.parent))
from common.logger import get_logger
from common.request_id import request_id_middleware

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
async def ocr_image(file: UploadFile = File(...)) -> dict[str, str]:
    if not pytesseract or not Image:
        raise HTTPException(status_code=500, detail="Tesseract OCR not available")
    contents = await file.read()
    image = Image.open(io.BytesIO(contents))
    text = pytesseract.image_to_string(image)
    return {"text": text}

class TextAnalyzeRequest(BaseModel):
    text: constr(strip_whitespace=True, min_length=1, max_length=100_000)


TEXT_LIMIT = 100_000
ALLOWED_FILE_TYPES = {"application/pdf", "image/png", "image/jpeg"}


@app.post("/analyze")
async def analyze(
    request: Request,
    file: Optional[UploadFile] = File(None),
    text: Optional[str] = Form(None),
):
    ctype = request.headers.get("content-type", "")

    if "application/json" in ctype:
        try:
            payload = await request.json()
        except Exception as exc:  # pragma: no cover - FastAPI handles body parsing
            raise HTTPException(status_code=422, detail="Invalid JSON") from exc
        try:
            req = TextAnalyzeRequest(**payload)
        except Exception as exc:
            raise HTTPException(status_code=422, detail="Invalid JSON shape") from exc
        return await analyze_text_flow(req.text, source="text")

    if "text/plain" in ctype:
        raw = await request.body()
        if len(raw) > TEXT_LIMIT:
            raise HTTPException(status_code=400, detail="Text exceeds limit")
        body_text = raw.decode("utf-8", errors="replace").strip()
        if not body_text:
            raise HTTPException(status_code=400, detail="Provide file or text")
        return await analyze_text_flow(body_text, source="text")

    if "multipart/form-data" in ctype:
        if text and text.strip():
            if len(text.encode("utf-8")) > TEXT_LIMIT:
                raise HTTPException(status_code=400, detail="Text exceeds limit")
            return await analyze_text_flow(text.strip(), source="text")
        if file is None:
            raise HTTPException(status_code=400, detail="Provide file or text")
        if file.content_type not in ALLOWED_FILE_TYPES:
            raise HTTPException(status_code=400, detail="Unsupported file type")
        content = await file.read()
        extracted = extract_text(content)
        return await analyze_text_flow(extracted, source="file", filename=file.filename, content_type=file.content_type)

    raise HTTPException(status_code=400, detail="Unsupported Content-Type")


async def analyze_text_flow(text: str, *, source: str, filename: str | None = None, content_type: str | None = None) -> dict:
    normalized = normalize_text(text)
    fields, confidence = extract_fields(normalized)
    response = {
        "revenue": fields.get("revenue", "N/A"),
        "employees": fields.get("employees", "N/A"),
        "ein": fields.get("ein", "N/A"),
        "year_founded": fields.get("year_founded", "N/A"),
        "confidence": confidence,
        "source": source,
    }
    extra = {"source": source}
    if filename:
        extra["filename"] = filename
    if content_type:
        extra["content_type"] = content_type
    logger.info("analyze", extra=extra)
    return response

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
