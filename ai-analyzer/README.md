# AI Analyzer Service

This FastAPI microservice extracts text from uploaded documents using Tesseract OCR
and parses simple business fields. The `/analyze` endpoint accepts `application/pdf`,
`image/png` and `image/jpeg` uploads.

## JSON / Text Input

The `/analyze` endpoint also accepts raw text via JSON or `text/plain` payloads.
The maximum text size is **100KB** and the response shape matches file uploads.

```bash
# JSON body
curl -X POST http://localhost:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{"text":"Revenue 1000; 10 employees; EIN 12-3456789"}'

# Plain text
curl -X POST http://localhost:8000/analyze \
  -H "Content-Type: text/plain" \
  --data-binary "Founded 2019; Employees 25"
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
