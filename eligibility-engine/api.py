from fastapi import FastAPI, Request, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
import time
import os
from pathlib import Path
import sys
from typing import Any
from prometheus_client import Histogram, CONTENT_TYPE_LATEST, generate_latest

CURRENT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(CURRENT_DIR.parent))
from common.logger import get_logger
from common.request_id import request_id_middleware
from grants_loader import load_grants
from engine import analyze_eligibility
from config import settings  # type: ignore

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
        REQ_LATENCY.labels(request.method, request.url.path, response.status_code).observe(time.time() - start)
    return response

if PROM_ENABLED:
    def metrics():
        return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

app = FastAPI(title="Grant Eligibility Engine")
try:
    app.middleware("http")(request_id_middleware)
except AttributeError:
    pass
app.middleware("http")(observability_middleware)

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

if PROM_ENABLED:
    app.get("/metrics")(metrics)

@app.get("/")
def root() -> dict[str, str]:
    return {"status": "ok"}

@app.get("/status")
def status() -> dict[str, str]:
    return {"status": "ok"}

GRANTS = load_grants()

@app.post("/check")
async def check_eligibility(request: Request):
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
    for g in GRANTS:
        if g["key"] == grant_key:
            return g
    raise HTTPException(status_code=404, detail="Grant not found")

if __name__ == "__main__":
    import uvicorn
    import ssl

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
