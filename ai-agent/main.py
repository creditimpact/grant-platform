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

app = FastAPI(title="AI Agent Service")


@app.post("/check")
async def check(request: Request, file: UploadFile = File(None), data: str = Form(None)):
    """Run eligibility check using provided data or uploaded document."""
    if data:
        payload = json.loads(data)
    elif request.headers.get("content-type", "").startswith("application/json"):
        payload = await request.json()
    else:
        payload = {}

    if file is not None:
        content = await file.read()
        payload.update(extract_fields(content))

    results = analyze_eligibility(payload, explain=True)
    return results


@app.post("/form-fill")
async def form_fill(body: dict):
    """Fill a grant form template with provided user data."""
    grant_key = body.get("grant")
    data = body.get("data", {})
    filled = fill_form(grant_key, data)
    return {"filled_form": filled}


@app.post("/chat")
async def chat(message: dict):
    """Placeholder for future chatbot integration."""
    return {"response": "Chat capability not implemented yet."}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=5001, reload=True)
