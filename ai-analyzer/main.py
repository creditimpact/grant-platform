from fastapi import FastAPI, File, UploadFile, HTTPException
from ocr_utils import extract_text
from nlp_parser import parse_fields

app = FastAPI()


@app.get("/")
def root() -> dict[str, str]:
    """Health check route."""
    return {"status": "ok"}


@app.get("/status")
def status() -> dict[str, str]:
    """Alias health check."""
    return {"status": "ok"}

ALLOWED_CONTENT_TYPES = {"application/pdf", "image/png", "image/jpeg"}


@app.post('/analyze')
async def analyze(file: UploadFile = File(...)):
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported file type")

    content = await file.read()
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
