# AI Analyzer Service

This FastAPI microservice extracts text from uploaded documents using Tesseract OCR
and parses simple business fields. The `/analyze` endpoint accepts `application/pdf`,
`image/png` and `image/jpeg` uploads.

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
