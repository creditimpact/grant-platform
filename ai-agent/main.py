from fastapi import FastAPI, Request, Body, UploadFile, File, Form, Depends, Header, HTTPException
from pydantic import BaseModel
from typing import Any
from pathlib import Path
import json
import sys
import os

# Resolve project directories and load environment variables
CURRENT_DIR = Path(__file__).resolve().parent

# ENV VALIDATION: load settings before other imports

# ensure local imports work regardless of working directory.  ``CURRENT_DIR``
# must take precedence so that ``config`` resolves to the ai-agent module and
# not to similarly named modules from sibling services such as the
# eligibility engine.  We therefore insert paths in reverse order so that the
# final ``sys.path`` starts with ``CURRENT_DIR``.
BASE_DIR = CURRENT_DIR.parent
ENGINE_DIR = BASE_DIR / "eligibility-engine"

# allow importing the eligibility engine (lowest precedence)
sys.path.insert(0, str(ENGINE_DIR))
# allow importing shared utilities
sys.path.insert(0, str(BASE_DIR))
# ensure ai-agent modules (like config) are searched first
sys.path.insert(0, str(CURRENT_DIR))

from common.logger import get_logger, audit_log

from engine import analyze_eligibility  # type: ignore
from document_utils import extract_fields
from form_filler import fill_form
from reasoning_generator import (
    generate_reasoning_steps,
    generate_llm_summary,
    generate_clarifying_questions,
    generate_reasoning_explanation,
)
from session_memory import append_memory, get_missing_fields, save_draft_form, get_conversation
from nlp_utils import llm_semantic_inference, llm_complete
from grants_loader import load_grants

try:
    from .config import settings  # type: ignore
except ImportError:  # pragma: no cover - script execution
    from config import settings  # type: ignore


def get_api_keys() -> list[str]:
    return [k for k in [settings.AI_AGENT_API_KEY, settings.AI_AGENT_NEXT_API_KEY] if k]

logger = get_logger(__name__)


async def verify_api_key(request: Request, x_api_key: str = Header(None)):
    """Ensure requests include one of the valid API keys."""
    ip = request.client.host if request.client else "unknown"
    if x_api_key not in get_api_keys():
        audit_log(logger, "auth_failure", ip=ip, api_key=x_api_key)
        raise HTTPException(status_code=401, detail="Unauthorized")
    audit_log(logger, "auth_success", ip=ip)


class FormFillRequest(BaseModel):
    """Schema for the /form-fill endpoint."""

    form_name: str
    user_payload: dict[str, Any]
    session_id: str | None = None


app = FastAPI(title="AI Agent Service", dependencies=[Depends(verify_api_key)])


@app.get("/")
def root() -> dict[str, str]:
    """Health check route."""
    return {"status": "ok"}


@app.get("/status")
def status() -> dict[str, str]:
    """Alias health check."""
    return {"status": "ok"}


@app.post("/check")
async def check(
    request: Request,
    file: UploadFile = File(None),
    data: str = Form(None),
    explain: bool = False,
    session_id: str | None = None,
):
    """Run eligibility check using provided data or uploaded document."""
    if data:
        payload = json.loads(data)
    elif request.headers.get("content-type", "").startswith("application/json"):
        payload = await request.json()
    else:
        payload = {}

    # query parameters override defaults
    qp = getattr(request, "query_params", {})
    if "explain" in qp:
        val = qp.get("explain")
        explain = str(val).lower() in {"1", "true", "yes"}
    if "session_id" in qp:
        session_id = qp.get("session_id")

    if file is not None:
        content = await file.read()
        payload.update(extract_fields(content))

    if isinstance(payload.get("notes"), str):
        payload = llm_semantic_inference(payload["notes"], payload)

    results = analyze_eligibility(payload, explain=True)

    if explain:
        grants = load_grants()
        for r in results:
            gdef = next((g for g in grants if g["name"] == r.get("name")), {})
            r["reasoning_steps"] = generate_reasoning_steps(gdef, payload, r)
    else:
        for r in results:
            r["reasoning_steps"] = []

    llm_summary = generate_llm_summary(results, payload)
    clarifying = generate_clarifying_questions(results)
    grants = load_grants()
    for r in results:
        r["llm_summary"] = llm_summary
        r["clarifying_questions"] = clarifying
        gdef = next((g for g in grants if g["name"] == r.get("name")), {})
        r["explanation"] = generate_reasoning_explanation(gdef, payload, r)

    if session_id:
        append_memory(session_id, {"payload": payload, "results": results})

    logger.info("eligibility_check", extra={"session_id": session_id, "grants_returned": len(results)})

    return results


@app.post("/form-fill", dependencies=[Depends(verify_api_key)])
async def form_fill(
    request_model: FormFillRequest = Body(
        ...,
        # Pydantic v2 removed the ``embed`` parameter so we rely on the default
        # behavior which expects the JSON fields at the top level.
        example={
            "form_name": "form_8974",
            "user_payload": {"employer_identification_number": "12-3456789"},
        }
    )
):
    """Fill a grant form template with provided user data."""
    if isinstance(request_model, dict):
        request_model = FormFillRequest(**request_model)

    grant_key = request_model.form_name
    data = request_model.user_payload
    session_id = request_model.session_id
    filled = fill_form(grant_key, data)

    if session_id:
        append_memory(session_id, {"form": grant_key, "data": data})

    return {"filled_form": filled}


@app.post("/preview-form", dependencies=[Depends(verify_api_key)])
async def preview_form(body: dict, file: UploadFile | None = None):
    """Preview a form with reasoning before final submission."""
    grant_key = body.get("grant")
    data = body.get("data", {})
    session_id = body.get("session_id")
    file_bytes = await file.read() if file else None
    filled = fill_form(grant_key, data, file_bytes)

    reasoning = {k: ("provided" if v else "auto-filled") for k, v in filled.get("fields", {}).items()}

    if session_id:
        save_draft_form(session_id, grant_key, filled.get("fields", {}))

    return {"filled_form": filled, "reasoning": reasoning, "files": filled.get("files", {})}


@app.post("/chat", dependencies=[Depends(verify_api_key)])
async def chat(message: dict):
    """Conversational endpoint backed by the LLM."""
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
        response = llm_complete(text, history=history_msgs)
        follow_up = []
        if session_id:
            missing = get_missing_fields(session_id)
            follow_up = [f"Please provide your {f}" for f in missing]
            append_memory(session_id, {"chat": {"text": text}, "response": response})
        result = {"response": response}
        if follow_up:
            result["follow_up"] = follow_up
        return result

    # fallback to canned responses when no free text supplied
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


@app.get("/llm-debug/{session_id}", dependencies=[Depends(verify_api_key)])
async def llm_debug(session_id: str):
    """Return a summary of agent actions for debugging."""
    if not ENABLE_DEBUG:
        raise HTTPException(status_code=403, detail="Debug access disabled")
    history = get_conversation(session_id)
    summary = [list(record.keys())[0] for record in history if record]
    inferred = [r.get("payload") for r in history if r.get("payload")]
    return {"summary": summary, "inferred": inferred}


if __name__ == "__main__":
    import uvicorn, ssl, os

    cert = os.getenv("TLS_CERT_PATH")
    key = os.getenv("TLS_KEY_PATH")
    ca = os.getenv("TLS_CA_PATH")
    kwargs: dict[str, object] = {"reload": True}
    if cert and key:
        kwargs.update({
            "ssl_certfile": cert,
            "ssl_keyfile": key,
        })
        if ca:
            kwargs["ssl_ca_certs"] = ca
            kwargs["ssl_cert_reqs"] = ssl.CERT_REQUIRED
    uvicorn.run(app, host="0.0.0.0", port=5001, **kwargs)
