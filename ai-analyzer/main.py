from fastapi import FastAPI, File, UploadFile, HTTPException, Depends, Request
import tempfile
import subprocess
import sys
from pathlib import Path
from ocr_utils import extract_text
from nlp_parser import parse_fields
from config import settings  # type: ignore

CURRENT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(CURRENT_DIR.parent))
from common.logger import get_logger
from common.request_id import request_id_middleware
from common.settings import load_security_settings
from common.security import require_api_key

security_settings, security_ready = load_security_settings()
_valid_keys = [k for k in [security_settings.AI_ANALYZER_API_KEY, security_settings.AI_ANALYZER_NEXT_API_KEY] if k]
require_internal_key = require_api_key(_valid_keys, "ai-analyzer")

logger = get_logger(__name__)


def scan_for_viruses(data: bytes) -> None:
    """Scan uploaded data using clamscan if available."""
    try:
        with tempfile.NamedTemporaryFile() as tmp:
            tmp.write(data)
            tmp.flush()
            result = subprocess.run(["clamscan", tmp.name], capture_output=True)
            if result.returncode == 1:
                raise HTTPException(status_code=400, detail="Virus detected")
            if result.returncode != 0:
                raise HTTPException(status_code=500, detail="Virus scan failed")
    except FileNotFoundError:
        raise HTTPException(status_code=500, detail="Virus scanner not available")


app = FastAPI(dependencies=[Depends(require_internal_key)])
try:
    app.middleware("http")(request_id_middleware)
except AttributeError:
    pass


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/readyz")
def readyz() -> dict[str, str]:
    if not (security_ready and _valid_keys):
        raise HTTPException(status_code=503, detail="not ready")
    return {"status": "ok"}


@app.get("/")
def root() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/status")
def status() -> dict[str, str]:
    return {"status": "ok"}

ALLOWED_CONTENT_TYPES = {"application/pdf", "image/png", "image/jpeg"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB


@app.post('/analyze')
async def analyze(file: UploadFile = File(...)):
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        logger.warning("upload rejected", extra={"reason": "type", "content_type": file.content_type})
        raise HTTPException(status_code=400, detail="Unsupported file type")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        logger.warning("upload rejected", extra={"reason": "size", "size": len(content)})
        raise HTTPException(status_code=413, detail="File too large")
    try:
        scan_for_viruses(content)
    except HTTPException as e:
        logger.warning("upload rejected", extra={"reason": "virus", "detail": e.detail})
        raise
    text = extract_text(content)
    fields, confidence = parse_fields(text)

    response = {
        "revenue": fields.get("revenue", "N/A"),
        "employees": fields.get("employees", "N/A"),
        "year_founded": fields.get("year_founded", "N/A"),
        "confidence": confidence,
    }
    logger.info("analyze", extra={"filename": file.filename, "content_type": file.content_type})
    return response


if __name__ == "__main__":
    import uvicorn, ssl, os

    cert = str(settings.TLS_CERT_PATH)
    key = str(settings.TLS_KEY_PATH)
    ca = str(settings.TLS_CA_PATH) if settings.TLS_CA_PATH else None
    kwargs: dict[str, object] = {}
    if cert and key:
        kwargs = {
            "ssl_certfile": cert,
            "ssl_keyfile": key,
        }
        if ca:
            kwargs["ssl_ca_certs"] = ca
            kwargs["ssl_cert_reqs"] = ssl.CERT_REQUIRED
    uvicorn.run(app, host="0.0.0.0", port=8000, **kwargs)
