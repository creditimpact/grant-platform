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

## Supported Documents

The analyzer performs document-type detection and structured extraction for:

- IRS Form W-2 (Wage and Tax Statement)
- IRS Form W-9 (Request for Taxpayer Identification Number and Certification)
- IRS Form 1120X (Amended U.S. Corporation Income Tax Return)
- IRS Form 941-X
- Tax payment receipts
- Business licenses, articles of incorporation, and EIN assignment letters
- Financial statements (profit & loss statements and balance sheets)
- Payroll registers and provider payroll reports (ADP, Gusto, QuickBooks Payroll, Paychex, Zenefits)
- Project documents such as business plans, grant use statements, energy savings reports, utility bills, installer contracts, equipment specs, and invoices/quotes
- U.S. DOT DBE/ACDBE Uniform Certification Application (all states)

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

### Payroll Register Output

Payroll uploads yield per-employee detail, period metadata, and document-level totals. A truncated example:

```json
{
  "doc_type": "Payroll_Register",
  "fields_clean": {
    "pay_period": {
      "start_date": "2023-01-01",
      "end_date": "2023-01-07",
      "check_date": "2023-01-10",
      "frequency": "weekly"
    },
    "employee_count": 12,
    "employees": [
      {
        "employee": {"id": "1001", "name": "Jane Smith", "ssn_last4": "4321"},
        "pay_components": {
          "regular_hours": 40.0,
          "regular_pay": 1200.0,
          "overtime_pay": 150.0,
          "gross_pay": 1500.0
        },
        "withholding": {
          "federal_wh": 200.0,
          "social_security": 93.0,
          "medicare": 21.75,
          "state_wh": 60.0
        },
        "net_pay": 1125.25,
        "ytd": {"total_pay": 3000.0, "federal_wh": 400.0, "net_pay": 2200.0}
      }
    ],
    "document_totals": {
      "gross": 18540.25,
      "withholding": 4820.13,
      "employer_taxes": 1890.42,
      "deductions_employee": 640.00,
      "net": 12089.70
    }
  },
  "parse_summary": {
    "rows_parsed": 12,
    "columns_mapped": 18,
    "columns_missing": []
  }
}
```

### Payroll Export Tips

- **ADP** – Reports ➜ Payroll ➜ Payroll Register ➜ export as PDF/CSV.
- **Gusto** – Reports ➜ Payroll ➜ Payroll Journal ➜ download the pay period register.
- **QuickBooks Payroll** – Reports ➜ Employees & Payroll ➜ Payroll Detail Review (export to CSV/XLSX).
- **Paychex** – Reports ➜ Payroll ➜ Payroll Summary; export via Flex as XLSX.
- **Zenefits** – Reports ➜ Payroll ➜ Payroll Register; choose CSV for structured tables.

Additional aliases are documented in
`eligibility-engine/contracts/field_map.json`.

### DBE/ACDBE Uniform Certification Application

The analyzer detects the U.S. DOT Disadvantaged Business Enterprise / Airport
Concession DBE Uniform Certification Application by looking for repeated title
phrases (for example “UNIFORM CERTIFICATION APPLICATION”, “49 C.F.R. Parts 23 &
26”, “Roadmap for Applicants”, “Section 1: CERTIFICATION INFORMATION”) and
common section headers used across state UCPs. Once detected the dedicated
extractor parses the certification basics, firm profile, ownership & control
sections, ACDBE-specific pages, and the affidavit signature block.

The extractor emits nested JSON under `fields_clean` capturing the DBE/ACDBE
application plus eligibility aliases (`company.*`, `owners`, `officers`,
`licenses`, `revenue.history`, `employees.counts`, `bank.bonding`,
`contracts.history`, `concessions`). A truncated example:

```json
{
  "doc_type": "DBE_ACDBE_Uniform_Application",
  "fields_clean": {
    "dbe": {
      "application": {
        "programsSelected": ["DBE", "ACDBE"],
        "homeStateUCP": "Western States Unified Certification Program",
        "siteVisitDates": [{"state": "CA", "date": "2023-04-01"}]
      }
    },
    "biz": {
      "legalName": "Horizon Equity Builders LLC",
      "streetAddressParsed": {"street": "482 Market Street, Suite 600", "city": "Denver", "state": "CO", "postal_code": "80202"},
      "employeeCounts": {"fullTime": 12, "partTime": 4, "seasonal": 3, "total": 19}
    },
    "owners": [
      {"fullName": "Maria Gomez", "ownershipPct": 60.0, "citizenship": "citizen", "personalNetWorth": {"present": true}}
    ],
    "control": {
      "officers": [{"name": "Maria Gomez", "title": "CEO", "dateAppointed": "2016-02-01"}],
      "duties": {"policy_decisions": {"frequency": "always", "active": true}},
      "bonding": {"aggregateLimit": 1500000.0, "projectLimit": 500000.0}
    },
    "acdbe": {
      "concessionSpaces": ["Denver International Airport, Concourse B Marketplace"]
    },
    "affidavit": {"present": true, "signer": "Maria Gomez", "date": "2024-04-04"},
    "eligibility": {
      "company.name": "Horizon Equity Builders LLC",
      "company.address": {"street": "482 Market Street, Suite 600", "city": "Denver", "state": "CO", "postal_code": "80202"},
      "owners": [{"name": "Maria Gomez", "percent": 60.0, "citizenship": "citizen", "ethnicity": ["Hispanic", "Native American"]}]
    }
  }
}
```

Sensitive identifiers are masked (`123-45-6789` → `###-##-6789`) and personal
net worth worksheets are recorded as presence booleans only. The extractor tags
every payload with `doc.pii=true` to flag regulated data. **Uploader tip:** if
the application is split across multiple scans, upload every page—the analyzer
merges the sections into a single normalized payload for the case file.

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
