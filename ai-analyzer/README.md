# AI Analyzer Service

This FastAPI microservice extracts text from uploaded documents using Tesseract OCR
and parses business fields such as EIN, W‑2 employee counts, quarterly revenues and
entity type. The `/analyze` endpoint accepts `application/pdf`, `image/png` and
`image/jpeg` uploads.

## JSON / Text Input

The `/analyze` endpoint also accepts raw text via JSON or `text/plain` payloads.
The maximum text size is **100KB** and the response shape matches file uploads.

```bash
# JSON body
curl -X POST http://localhost:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{"text":"EIN 12-3456789; W-2 employees: 13; Q1 2023 revenue $120k; LLC"}'

# Plain text
curl -X POST http://localhost:8000/analyze \
  -H "Content-Type: text/plain" \
  --data-binary "Founded 2019; W2 employees 25"

# File upload
curl -X POST http://localhost:8000/analyze -F "file=@samples/quarterly_report.pdf"
```

## Local Development Setup

```bash
echo "" > dummy-cert
echo "" > dummy-key
cat > .env <<'EOF'
NODE_ENV=development
EOF

$env:PYTHONPATH=".."
python -m uvicorn main:app --port 8000
```

## Running tests

Install the dependencies and run the test suite:

```bash
pip install -r requirements.txt
pytest
```
