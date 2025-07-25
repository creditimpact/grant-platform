from fastapi import FastAPI, File, UploadFile
from ocr_utils import extract_text
from nlp_parser import parse_fields

app = FastAPI()

@app.post('/analyze')
async def analyze(file: UploadFile = File(...)):
    if file.content_type not in {"application/pdf", "image/png", "image/jpeg"}:
        print(f"Unsupported file type received: {file.content_type}")

    content = await file.read()
    text = extract_text(content)
    data = parse_fields(text)

    response = {
        "revenue": data.get("revenue", "N/A"),
        "employees": data.get("employees", "N/A"),
        "year_founded": data.get("year_founded", "N/A"),
    }
    return response


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
