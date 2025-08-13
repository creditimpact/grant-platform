# AI Analyzer Service

This FastAPI microservice extracts text from uploaded documents using Tesseract OCR
and parses simple business fields. The `/analyze` endpoint accepts `application/pdf`,
`image/png` and `image/jpeg` uploads.

## Security

Uploads are protected with several layers of security:

* **API key authentication** – requests must include an `X-API-Key` header that matches
  the `AI_ANALYZER_API_KEY` environment variable (or `AI_ANALYZER_NEXT_API_KEY` during
  rotation). Unauthorized requests return `401`.
* **File size limit** – files larger than **5MB** are rejected with a `413` error.
* **Virus scanning** – uploaded files are scanned with `clamscan` (path configurable via `CLAMSCAN_PATH`). Infected files
  result in a `400` response. If the scanner is unavailable the service responds
  with a `500` error.

## Local Development Setup

```bash
echo "" > dummy-cert
echo "" > dummy-key
cat > .env <<'EOF'
NODE_ENV=development
AI_ANALYZER_API_KEY=dev-analyzer-key
TLS_CERT_PATH=dummy-cert
TLS_KEY_PATH=dummy-key
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
