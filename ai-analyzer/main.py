from fastapi import FastAPI, File, UploadFile
from ocr_utils import extract_text
from nlp_parser import parse_fields

app = FastAPI()

@app.post('/analyze')
async def analyze(file: UploadFile = File(...)):
    # Read the uploaded file
    content = await file.read()
    # Call OCR utility (stub)
    text = extract_text(content)
    # Call NLP parser (stub)
    data = parse_fields(text)
    # For now, return dummy data merged with parsed fields
    response = {
        "revenue": data.get("revenue", "N/A"),
        "employees": data.get("employees", "N/A"),
        "year_founded": data.get("year_founded", "N/A"),
    }
    return response
