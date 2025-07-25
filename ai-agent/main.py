from fastapi import FastAPI, UploadFile, File, Form, Request
from pathlib import Path
import json
import sys

# allow importing the eligibility engine
BASE_DIR = Path(__file__).resolve().parents[1]
ENGINE_DIR = BASE_DIR / "eligibility-engine"
sys.path.insert(0, str(ENGINE_DIR))

from engine import analyze_eligibility  # type: ignore
from document_utils import extract_fields
from form_filler import fill_form
from reasoning_generator import (
    generate_reasoning_steps,
    generate_llm_summary,
    generate_clarifying_questions,
)
from session_memory import append_memory, get_missing_fields
from nlp_utils import llm_semantic_inference
from grants_loader import load_grants

app = FastAPI(title="AI Agent Service")


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
    for r in results:
        r["llm_summary"] = llm_summary
        r["clarifying_questions"] = clarifying

    if session_id:
        append_memory(session_id, {"payload": payload, "results": results})

    return results


@app.post("/form-fill")
async def form_fill(body: dict, file: UploadFile | None = None):
    """Fill a grant form template with provided user data."""
    grant_key = body.get("grant")
    data = body.get("data", {})
    session_id = body.get("session_id")
    file_bytes = await file.read() if file else None
    filled = fill_form(grant_key, data, file_bytes)

    if session_id:
        append_memory(
            session_id,
            {"form": grant_key, "data": data, "used_file": bool(file_bytes)},
        )

    return {"filled_form": filled}


@app.post("/chat")
async def chat(message: dict):
    """Basic pre-LLM chat endpoint with several modes."""
    mode = message.get("mode", "info")
    grant_key = message.get("grant")
    session_id = message.get("session_id")

    grants = load_grants()
    grant = next((g for g in grants if g.get("key") == grant_key), None)

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


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=5001, reload=True)
