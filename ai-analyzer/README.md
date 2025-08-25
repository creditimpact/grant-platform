# AI Analyzer Service

This FastAPI microservice extracts text from uploaded documents using Tesseract OCR
and parses business fields such as EIN, W‑2 employee counts, quarterly revenues and
entity type. The `/analyze` endpoint accepts `.pdf`, `.docx`, `.txt`, `.png`, `.jpeg`,
`.jpg` and `.bmp` uploads. A separate `/analyze-ai` endpoint can be enabled with
`USE_AI_ANALYZER=true` and an `OPENAI_API_KEY`; it sends OCR text to OpenAI for
richer field extraction.

Set `TESSERACT_CMD` to the path of the Tesseract executable if it's not
already available on your `PATH`.

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

## OpenAI-Powered Extraction

Set `USE_AI_ANALYZER=true` and provide `OPENAI_API_KEY` to enable the `/analyze-ai` endpoint. It accepts the same inputs as `/analyze` but uses OpenAI to fill a structured JSON response.

## Field Names Emitted

Parsed documents yield a `fields` object whose keys feed directly into the
eligibility engine after normalization. Common field names include:

| Field | Example |
| ----- | ------- |
| `ein` | `12-3456789` |
| `employees` | `13` |
| `revenue_drop_2020_pct` | `55%` |
| `annual_revenue` | `$1,200,000` |
| `payroll_total` | `$950k` |

Additional aliases are documented in
`eligibility-engine/contracts/field_map.json`.

### Payroll Total Extraction

The analyzer detects company‑wide payroll totals using phrases like "Total Payroll",
"Payroll Total", "Gross Payroll", "Total Wages" and "Total Compensation". Amounts
may appear in forms such as `$1,234,567.89`, `950k`, `2.3M` or with parentheses
`($120,000)`. All values are normalized to whole USD before being returned as
`payroll_total`.

## Local Development Setup

```bash
echo "" > dummy-cert
echo "" > dummy-key
cat > .env <<'EOF'
NODE_ENV=development
# optional: path to the Tesseract executable
TESSERACT_CMD=/usr/bin/tesseract
EOF

$env:PYTHONPATH=".."
python -m uvicorn main:app --port 8000
```

## Tests & Lint

```powershell
# Windows (PowerShell)
python -m venv .\venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Run tests
pytest -q

# Lint (flake8)
flake8

# Run service locally
uvicorn ai_analyzer.main:app --host 0.0.0.0 --port 8000
```
