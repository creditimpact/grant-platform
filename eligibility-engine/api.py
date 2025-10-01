from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
import time
import os
from pathlib import Path
import sys
from typing import Any, Dict, List
from pydantic import ValidationError
from prometheus_client import Histogram, CONTENT_TYPE_LATEST, generate_latest

CURRENT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(CURRENT_DIR.parent))
from common.logger import get_logger
from common.request_id import request_id_middleware
from grants_loader import load_grants
from engine import analyze_eligibility
from config import settings  # type: ignore
from models import ResultsEnvelope, GrantResult
from normalization.ingest import normalize_payload

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


@app.exception_handler(ValidationError)
async def validation_exception_handler(_: Request, exc: ValidationError):
    return JSONResponse(status_code=422, content={"detail": exc.errors()})


@app.exception_handler(HTTPException)
async def http_exception_handler(_: Request, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.exception_handler(Exception)
async def unhandled_exception_handler(_: Request, exc: Exception):
    logger.error("unhandled_exception", extra={"error": str(exc)})
    return JSONResponse(
        status_code=500,
        content={"detail": "Unexpected server error. Please retry or contact support."},
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
async def check(payload: Dict[str, Any]) -> Any:
    if not isinstance(payload, dict) or not payload:
        raise HTTPException(status_code=400, detail="Request body must be a non-empty JSON object.")

    try:
        grant_results = await compute_grant_results(payload)
        logger.info("eligibility_check", extra={"fields": list(payload.keys())})
    except KeyError as ke:
        logger.error("eligibility_check_failed", extra={"error": f"Missing required field: {ke}"})
        raise HTTPException(status_code=422, detail=f"Missing required field: {ke}") from ke
    except ValueError as ve:
        logger.error("eligibility_check_failed", extra={"error": str(ve)})
        raise HTTPException(status_code=400, detail=str(ve)) from ve

    typed_results: List[GrantResult] = [GrantResult(**gr) for gr in grant_results]

    if not settings.WRAP_RESULTS:
        return [r.model_dump(by_alias=True, exclude_none=True) for r in typed_results]

    agg_forms: List[str] = []
    agg_documents: List[str] = []
    for r in typed_results:
        if r.required_forms:
            for frm in r.required_forms:
                if frm not in agg_forms:
                    agg_forms.append(frm)
        if r.required_documents:
            for doc in r.required_documents:
                if doc not in agg_documents:
                    agg_documents.append(doc)

    envelope = ResultsEnvelope(
        results=typed_results,
        required_forms=agg_forms,
        required_documents=agg_documents,
    )
    return envelope.model_dump(by_alias=True, exclude_none=True)

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


async def compute_grant_results(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    normalized = normalize_payload(payload)
    return analyze_eligibility(normalized, explain=True)

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
