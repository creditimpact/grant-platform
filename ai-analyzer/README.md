# AI Analyzer Service

This FastAPI microservice extracts text from uploaded documents using Tesseract OCR
and parses simple business fields. The `/analyze` endpoint accepts `application/pdf`,
`image/png` and `image/jpeg` uploads.

## Security

Uploads are protected with several layers of security:

* **API key authentication** – requests must include an `X-API-Key` header that matches
  the `INTERNAL_API_KEY` environment variable. Unauthorized requests return `401`.
* **File size limit** – files larger than **5MB** are rejected with a `413` error.
* **Virus scanning** – uploaded files are scanned with `clamscan` (path configurable via `CLAMSCAN_PATH`). Infected files
  result in a `400` response. If the scanner is unavailable the service responds
  with a `500` error.

## Running tests

Install the dependencies and run the test suite:

```bash
pip install -r requirements.txt
pytest
```
