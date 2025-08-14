from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.responses import Response, JSONResponse
from engine import analyze_eligibility
from grants_loader import load_grants
import os
import sys
import time
from pathlib import Path
from prometheus_client import Histogram, CONTENT_TYPE_LATEST, generate_latest
from common.logger import get_logger
from common.request_id import request_id_middleware
from common.settings import load_security_settings
from common.security import require_api_key
from common.limiting import rate_limiter
from config import settings  # type: ignore
from fastapi.middleware.cors import CORSMiddleware

CURRENT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(CURRENT_DIR.parent))


security_settings, security_ready = load_security_settings()
_valid_keys = [k for k in [security_settings.ELIGIBILITY_ENGINE_API_KEY, security_settings.ELIGIBILITY_ENGINE_NEXT_API_KEY] if k]
require_internal_key = require_api_key(_valid_keys, "eligibility-engine")

logger = get_logger(__name__)

OBS_ENABLED = os.getenv("OBSERVABILITY_ENABLED") == "true"
PROM_ENABLED = OBS_ENABLED and os.getenv("PROMETHEUS_METRICS_ENABLED") == "true"

if PROM_ENABLED:
    REQ_LATENCY = Histogram(
        "http_request_duration_seconds",
        "Request duration",
        ["method", "path", "status"],
    )


async def observability_middleware(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    if PROM_ENABLED:
        REQ_LATENCY.labels(request.method, request.url.path, response.status_code).observe(
            time.time() - start
        )
    return response


if PROM_ENABLED:
    def metrics():
        return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


app = FastAPI(title="Grant Eligibility Engine", dependencies=[Depends(require_internal_key), rate_limiter("eligibility-engine")])
try:
    app.middleware("http")(request_id_middleware)
except AttributeError:
    pass
app.middleware("http")(observability_middleware)

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
