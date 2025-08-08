from fastapi import FastAPI, File, UploadFile, HTTPException, Depends, Header, Request
import os
import tempfile
import subprocess
import sys
from pathlib import Path
from ocr_utils import extract_text
from nlp_parser import parse_fields

CURRENT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(CURRENT_DIR.parent))
from common.logger import get_logger, audit_log

API_KEY = os.getenv("INTERNAL_API_KEY")

logger = get_logger(__name__)


async def verify_api_key(request: Request, x_api_key: str = Header(None)):
    ip = request.client.host if request.client else "unknown"
    if not API_KEY or x_api_key != API_KEY:
        audit_log(logger, "auth_failure", ip=ip, api_key=x_api_key)
        raise HTTPException(status_code=401, detail="Unauthorized")
    audit_log(logger, "auth_success", ip=ip)


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


app = FastAPI(dependencies=[Depends(verify_api_key)])


@app.get("/")
def root() -> dict[str, str]:
    """Health check route."""
    return {"status": "ok"}


@app.get("/status")
def status() -> dict[str, str]:
    """Alias health check."""
    return {"status": "ok"}

ALLOWED_CONTENT_TYPES = {"application/pdf", "image/png", "image/jpeg"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB


@app.post('/analyze')
async def analyze(file: UploadFile = File(...)):
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported file type")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large")
    scan_for_viruses(content)
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

    cert = os.getenv("TLS_CERT_PATH")
    key = os.getenv("TLS_KEY_PATH")
    ca = os.getenv("TLS_CA_PATH")
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
