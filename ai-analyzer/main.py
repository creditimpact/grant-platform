from fastapi import FastAPI, File, UploadFile, HTTPException, Depends, Request
import tempfile
import subprocess
import sys
import os
from pathlib import Path
from ocr_utils import extract_text
from nlp_parser import parse_fields
from config import settings  # type: ignore
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

CURRENT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(CURRENT_DIR.parent))
from common.logger import get_logger
from common.request_id import request_id_middleware
from common.settings import load_security_settings
from common.security import require_api_key
from common.limiting import rate_limiter

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


app = FastAPI(dependencies=[Depends(require_internal_key), rate_limiter("ai-analyzer")])
try:
    app.middleware("http")(request_id_middleware)
except AttributeError:
    pass

origins_env = os.getenv("ALLOWED_ORIGINS")
if origins_env:
    origins = [o.strip() for o in origins_env.split(",") if o.strip()]
else:
    origins = [os.getenv("FRONTEND_URL"), os.getenv("ADMIN_URL")]
    origins = [o for o in origins if o]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type", "Authorization", "X-API-Key", "X-Request-Id"],
)


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/readyz")
def readyz() -> JSONResponse:
    checks: dict[str, str] = {}
    security_ok = security_ready and bool(_valid_keys)
    checks["security"] = "ok" if security_ok else "missing_keys"

    if security_settings.SECURITY_ENFORCEMENT_LEVEL == "prod" and not security_settings.DISABLE_VAULT:
        checks["vault"] = "ok" if security_ready else "unavailable"
    else:
        checks["vault"] = "skipped"

    ready = all(v in {"ok", "skipped"} for v in checks.values())
    status = "ready" if ready else "not_ready"
    code = 200 if ready else 503
    return JSONResponse(status_code=code, content={"status": status, "checks": checks})


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
