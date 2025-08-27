from fastapi import FastAPI, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import Any
from pathlib import Path
import sys
import os

CURRENT_DIR = Path(__file__).resolve().parent
BASE_DIR = CURRENT_DIR.parent
ENGINE_DIR = BASE_DIR / "eligibility-engine"

sys.path.insert(0, str(ENGINE_DIR))
sys.path.insert(0, str(BASE_DIR))
sys.path.insert(0, str(CURRENT_DIR))

from common.logger import get_logger
from common.request_id import request_id_middleware

from engine import analyze_eligibility  # type: ignore
from fill_form import fill_form, _normalize_state, _normalize_zip, YES_NO_FIELDS
from session_memory import append_memory, get_missing_fields, save_draft_form, get_conversation
from nlp_utils import llm_semantic_inference, llm_complete
from grants_loader import load_grants

from config import settings  # type: ignore

from schemas import (
    AgentCheckRequest,
    AgentCheckResponse,
    FormFillRequest,
    FormFillResponse,
    Reasoning,
)
from utils.dates import normalize_dates_in_mapping
from utils.merge import merge_preserving_user
from utils.reasoning import build_clarifying_questions

logger = get_logger(__name__)


app = FastAPI(title="AI Agent Service")
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


@app.post("/check")
async def check(request_model: AgentCheckRequest) -> AgentCheckResponse:
    payload: dict[str, Any] = {}
    if request_model.profile:
        payload.update(request_model.profile.model_dump(exclude_none=True))
    if request_model.analyzer_fields:
        filled_keys: list[str] = []
        for k, v in request_model.analyzer_fields.items():
            if k not in payload or payload[k] in (None, ""):
                payload[k] = v
                filled_keys.append(k)
        if filled_keys:
            logger.debug("analyzer_backfill", extra={"keys": filled_keys})

    normalized_profile, norm_steps = normalize_dates_in_mapping(payload)

    inferred = (
        llm_semantic_inference(request_model.notes, dict(normalized_profile))
        if request_model.notes
        else dict(normalized_profile)
    )

    merged_profile, merge_steps = merge_preserving_user(normalized_profile, inferred)

    results = analyze_eligibility(merged_profile, explain=True)
    missing: set[str] = set()
    for res in results:
        missing.update(res.get("missing_fields", []))

    reasoning_steps = norm_steps + merge_steps
    clarifying = build_clarifying_questions(sorted(missing))
    reasoning = Reasoning(reasoning_steps=reasoning_steps, clarifying_questions=clarifying)

    if request_model.session_id:
        append_memory(request_model.session_id, {"payload": merged_profile, "results": results})

    logger.info(
        "eligibility_check",
        extra={"session_id": request_model.session_id, "grants_returned": len(results)},
    )

    return AgentCheckResponse(
        normalized_profile=merged_profile, eligibility=results, reasoning=reasoning
    )


@app.post("/form-fill")
async def form_fill(request_model: FormFillRequest) -> FormFillResponse:
    payload: dict[str, Any] = dict(request_model.user_payload)
    if request_model.analyzer_fields:
        filled_keys: list[str] = []
        for k, v in request_model.analyzer_fields.items():
            if k not in payload or payload[k] in (None, ""):
                payload[k] = v
                filled_keys.append(k)
        if filled_keys:
            logger.debug("analyzer_backfill", extra={"keys": filled_keys})
    normalized_data, norm_steps = normalize_dates_in_mapping(payload)
    filled = fill_form(request_model.form_name, normalized_data)

    merged_fields, merge_steps = merge_preserving_user(
        normalized_data, filled.get("fields", {})
    )
    for k, v in list(merged_fields.items()):
        if isinstance(v, str):
            nv = v.strip()
            if k.endswith("_zip") or k == "zip":
                nv = _normalize_zip(nv)
            elif k.endswith("_state") or k == "state":
                nv = _normalize_state(nv)
            merged_fields[k] = nv
    for k in YES_NO_FIELDS:
        if k in merged_fields:
            v = merged_fields[k]
            if isinstance(v, bool):
                merged_fields[k] = "yes" if v else "no"
            elif isinstance(v, str):
                lv = v.strip().lower()
                if lv in {"y", "yes", "true", "1"}:
                    merged_fields[k] = "yes"
                elif lv in {"n", "no", "false", "0"}:
                    merged_fields[k] = "no"
    for k, v in list(merged_fields.items()):
        if k.startswith("funding_"):
            if isinstance(v, str):
                try:
                    merged_fields[k] = float(v.replace("$", "").replace(",", ""))
                except ValueError:
                    continue
    fund_keys = [k for k in merged_fields if k.startswith("funding_") and k != "funding_total"]
    if fund_keys:
        total = 0.0
        for k in fund_keys:
            val = merged_fields.get(k)
            if isinstance(val, (int, float)):
                total += float(val)
        merged_fields["funding_total"] = total
    filled["fields"] = merged_fields

    reasoning_steps = norm_steps + merge_steps
    reasoning = "; ".join(reasoning_steps)

    if request_model.session_id:
        append_memory(
            request_model.session_id,
            {"form": request_model.form_name, "data": normalized_data},
        )
    return FormFillResponse(
        filled_form=filled, reasoning=reasoning
    )


@app.post("/preview-form")
async def preview_form(body: dict, file: UploadFile | None = None):
    grant_key = body.get("grant")
    data = body.get("data", {})
    session_id = body.get("session_id")
    file_bytes = await file.read() if file else None
    filled = fill_form(grant_key, data, file_bytes)

    reasoning = {k: ("provided" if v else "auto-filled") for k, v in filled.get("fields", {}).items()}

    if session_id:
        save_draft_form(session_id, grant_key, filled.get("fields", {}))

    return {"filled_form": filled, "reasoning": reasoning, "files": filled.get("files", {})}


@app.post("/chat")
async def chat(message: dict):
    mode = message.get("mode")
    text = message.get("text") or message.get("prompt")
    grant_key = message.get("grant")
    session_id = message.get("session_id")

    grants = load_grants()
    grant = next((g for g in grants if g.get("key") == grant_key), None)

    if text:
        history_msgs = []
        if session_id:
            for entry in get_conversation(session_id):
                chat = entry.get("chat")
                if chat and chat.get("text"):
                    history_msgs.append({"role": "user", "content": chat.get("text")})
                if entry.get("response"):
                    history_msgs.append({"role": "assistant", "content": entry["response"]})
        response = llm_complete(text, None, history=history_msgs)
        follow_up = []
        if session_id:
            missing = get_missing_fields(session_id)
            follow_up = [f"Please provide your {f}" for f in missing]
            append_memory(session_id, {"chat": {"text": text}, "response": response})
        result = {"response": response}
        if follow_up:
            result["follow_up"] = follow_up
        return result

    mode = mode or "info"
    if mode == "info":
        response = "I can help match you to grants and fill forms."
    elif mode == "explain_grant" and grant:
        response = grant.get("human_summary", grant.get("description", ""))
    elif mode == "what_else":
        response = "Check back soon for additional opportunities."
    elif mode == "missing_docs" and grant:
        docs = [d for cat in grant.get("required_documents", {}).values() for d in cat]
        response = "Required documents: " + ", ".join(docs)
    elif mode == "missing_info" and session_id:
        qs = get_missing_fields(session_id)
        response = "Missing info: " + ", ".join(qs) if qs else "All required data provided."
    else:
        response = "I'm not sure how to help with that."

    if session_id:
        append_memory(session_id, {"chat": message, "response": response})

    return {"response": response}


ENABLE_DEBUG = os.getenv("ENABLE_DEBUG", "false").lower() == "true"


@app.get("/llm-debug/{session_id}")
async def llm_debug(session_id: str):
    if not ENABLE_DEBUG:
        raise HTTPException(status_code=403, detail="Debug access disabled")
    history = get_conversation(session_id)
    summary = [list(record.keys())[0] for record in history if record]
    inferred = [r.get("payload") for r in history if r.get("payload")]
    return {"summary": summary, "inferred": inferred}


if __name__ == "__main__":
    import uvicorn
    import ssl

    cert = os.getenv("TLS_CERT_PATH")
    key = os.getenv("TLS_KEY_PATH")
    ca = os.getenv("TLS_CA_PATH")
    kwargs: dict[str, object] = {"reload": True}
    if cert and key:
        kwargs.update({"ssl_certfile": cert, "ssl_keyfile": key})
        if ca:
            kwargs["ssl_ca_certs"] = ca
            kwargs["ssl_cert_reqs"] = ssl.CERT_REQUIRED
    uvicorn.run(app, host="0.0.0.0", port=5001, **kwargs)
