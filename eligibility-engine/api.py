from fastapi import FastAPI, Request, HTTPException, Depends, Header
from engine import analyze_eligibility
from grants_loader import load_grants
import os
import sys
from pathlib import Path
from common.logger import get_logger, audit_log
from config import settings  # ENV VALIDATION

CURRENT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(CURRENT_DIR.parent))

API_KEY = settings.INTERNAL_API_KEY

logger = get_logger(__name__)


async def verify_api_key(request: Request, x_api_key: str = Header(None)):
    ip = request.client.host if request.client else "unknown"
    if not API_KEY or x_api_key != API_KEY:
        audit_log(logger, "auth_failure", ip=ip, api_key=x_api_key)
        raise HTTPException(status_code=401, detail="Unauthorized")
    audit_log(logger, "auth_success", ip=ip)


app = FastAPI(title="Grant Eligibility Engine", dependencies=[Depends(verify_api_key)])


@app.get("/")
def root() -> dict[str, str]:
    """Health check route."""
    return {"status": "ok"}


@app.get("/status")
def status() -> dict[str, str]:
    """Alias health check."""
    return {"status": "ok"}

GRANTS = load_grants()


@app.post("/check")
async def check_eligibility(request: Request):
    """Check grant eligibility for provided user data."""
    try:
        data = await request.json()
        result = analyze_eligibility(data, explain=True)
        logger.info("eligibility_check", extra={"fields": list(data.keys())})
        return result
    except Exception as e:
        return {"error": str(e)}


@app.get("/grants")
def list_grants():
    """List all available grants with metadata."""
    return [
        {
            "key": g["key"],
            "name": g.get("name"),
            "tags": g.get("tags", []),
            "ui_questions": g.get("ui_questions", []),
            "description": g.get("description", ""),
        }
        for g in GRANTS
    ]


@app.get("/grants/{grant_key}")
def get_grant(grant_key: str):
    """Retrieve a single grant configuration by key."""
    for g in GRANTS:
        if g["key"] == grant_key:
            return g
    raise HTTPException(status_code=404, detail="Grant not found")


if __name__ == "__main__":
    import uvicorn, ssl, os

    cert = str(settings.TLS_CERT_PATH)
    key = str(settings.TLS_KEY_PATH)
    ca = str(settings.TLS_CA_PATH) if settings.TLS_CA_PATH else None
    kwargs: dict[str, object] = {"reload": True}
    if cert and key:
        kwargs.update({"ssl_certfile": cert, "ssl_keyfile": key})
        if ca:
            kwargs["ssl_ca_certs"] = ca
            kwargs["ssl_cert_reqs"] = ssl.CERT_REQUIRED
    uvicorn.run("api:app", host="0.0.0.0", port=4001, **kwargs)
