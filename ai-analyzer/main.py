from fastapi import FastAPI, File, UploadFile, HTTPException, Depends, Header
import os
import tempfile
import subprocess
from ocr_utils import extract_text
from nlp_parser import parse_fields

API_KEY = os.getenv("INTERNAL_API_KEY")


async def verify_api_key(x_api_key: str = Header(None)):
    if not API_KEY or x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")


def scan_for_viruses(data: bytes) -> None:
    """Scan uploaded data using clamscan if available."""
    try:
        with tempfile.NamedTemporaryFile() as tmp:
            tmp.write(data)
            tmp.flush()
            result = subprocess.run(["clamscan", tmp.name], capture_output=True)
            if result.returncode == 1:
                raise HTTPException(status_code=400, detail="Virus detected")
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
    return response


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
