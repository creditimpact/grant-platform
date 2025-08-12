from fastapi import FastAPI, Request, HTTPException, Depends, Header
from fastapi.responses import Response
from engine import analyze_eligibility
from grants_loader import load_grants
import os
import sys
import time
import uuid
from pathlib import Path
from prometheus_client import Histogram, CONTENT_TYPE_LATEST, generate_latest
from common.logger import get_logger, audit_log
try:
    from .config import settings  # type: ignore
except ImportError:  # pragma: no cover
    from config import settings  # type: ignore

CURRENT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(CURRENT_DIR.parent))


def get_api_keys() -> list[str]:
    return [k for k in [settings.ELIGIBILITY_ENGINE_API_KEY, settings.ELIGIBILITY_ENGINE_NEXT_API_KEY] if k]

logger = get_logger(__name__)

OBS_ENABLED = os.getenv("OBSERVABILITY_ENABLED") == "true"
PROM_ENABLED = OBS_ENABLED and os.getenv("PROMETHEUS_METRICS_ENABLED") == "true"
REQ_ID_ENABLED = os.getenv("REQUEST_ID_ENABLED") == "true"
REQ_LOG_JSON = os.getenv("REQUEST_LOG_JSON") == "true"

if PROM_ENABLED:
    REQ_LATENCY = Histogram(
        "http_request_duration_seconds",
        "Request duration",
        ["method", "path", "status"],
    )


async def observability_middleware(request: Request, call_next):
    req_id = None
    if REQ_ID_ENABLED or REQ_LOG_JSON:
        req_id = request.headers.get("x-request-id") or str(uuid.uuid4())
        request.state.request_id = req_id
    start = time.time()
    response = await call_next(request)
    if req_id:
        response.headers["X-Request-Id"] = req_id
    if PROM_ENABLED:
        REQ_LATENCY.labels(request.method, request.url.path, response.status_code).observe(
            time.time() - start
        )
    if REQ_LOG_JSON:
        logger.info(
            "request",
            extra={
                "request_id": req_id,
                "path": request.url.path,
                "status": response.status_code,
                "latency_ms": round((time.time() - start) * 1000),
            },
        )
    return response


if PROM_ENABLED:
    def metrics():
        return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


async def verify_api_key(request: Request, x_api_key: str = Header(None)):
    ip = request.client.host if request.client else "unknown"
    if x_api_key not in get_api_keys():
        audit_log(logger, "auth_failure", ip=ip, api_key=x_api_key)
        raise HTTPException(status_code=401, detail="Unauthorized")
    audit_log(logger, "auth_success", ip=ip)


app = FastAPI(title="Grant Eligibility Engine", dependencies=[Depends(verify_api_key)])
app.middleware("http")(observability_middleware)
if PROM_ENABLED:
    app.get("/metrics")(metrics)


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
        logger.error("eligibility_check_failed", extra={"error": str(e)})
        raise HTTPException(status_code=500, detail="internal error")


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
