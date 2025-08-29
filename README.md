# Grant AI Platform Backend

This repository contains three microservices used to test a grant eligibility workflow.

- **server/** – Express API for file uploads and analysis forwarding
- **ai-analyzer/** – FastAPI service that extracts text using Tesseract OCR and simple NLP with confidence scores
- **eligibility-engine/** – Python rules engine returning missing fields and suggested next steps
- **ai-agent/** – LLM-ready service with conversational endpoints and smart form filling

All Node.js dependencies are pinned to exact versions, and the server runs on the stable Express 4.18.2 release for consistent builds. Python microservice dependencies are likewise pinned in their respective `requirements.txt` files.

## Persistence

User cases, pipeline state, uploaded file metadata and AI agent conversations are now stored in MongoDB. Sessions are persisted in a TTL-indexed collection and file uploads stream to disk with their paths tracked in the database.

The eligibility engine now ships with templates for common programs including a Business Tax Refund Grant, a Veteran Owned Business Grant, the Employee Retention Credit (ERC), a comprehensive Rural Development Grant covering USDA sub-programs, a Green Energy State Incentive aggregating state-level rebates, credits and grants for renewable installations, an Urban Small Business Grants (2025) package spanning nine city programs, and a California Small Business Grant (2025) bundling the Dream Fund, STEP export vouchers, San Francisco Women’s Entrepreneurship Fund, Route 66 Extraordinary Women Micro-Grant, CDFA grants, RUST assistance, CalChamber awards and the LA Region Small Business Relief Fund.
The Rural Development configuration now includes federal form templates for SF-424, 424A, RD 400-1, RD 400-4 and RD 400-8.

```
project-root/
  server/               Express REST API
  ai-agent/             FastAPI form filler and reasoning service
  ai-analyzer/          OCR/NLP stub service
  eligibility-engine/   Core rules engine
  frontend/             Next.js application
```

The document upload flow accepts **PDF**, **JPG/JPEG**, and **PNG** files up to 5MB each.

## Document Library

A versioned evidence library lives under `shared/document_library/`. The schema
in `schema.json` validates the grant catalog, and `grants_v1.json` lists the
required documents per grant key. The AI analyzer reads document type detectors
from `shared/document_types/catalog.json`.

To extend the library:

1. Add a new document type detector in
   `shared/document_types/catalog.json`.
2. Define the evidence requirements in a new versioned file under
   `shared/document_library/` (e.g. `grants_v2.json`).
3. Update services to reference the new version if needed.

### Veteran Owned Business Grant

This program awards a flat $10,000 to five veteran-owned small businesses each year.
To qualify, a business must:

- Have at least 51% ownership by a veteran or military spouse.
- Employ between 3 and 20 people.
- Earn no more than $5 million in annual revenue.
- Operate in one of the 50 U.S. states and be located in an economically vulnerable area.
- Avoid disqualified business types such as non-profits or restricted franchises.

## Grant Submission Pipeline

The backend exposes a unified flow that processes grant applications end‑to‑end:

1. **POST `/api/files/upload`** – Upload a document. The server forwards the file to the AI Analyzer (`AI_ANALYZER_URL/analyze`) to extract and normalize fields.
2. **POST `/api/questionnaire`** – Persist user supplied answers and merge them with analyzer fields.
3. **POST `/api/eligibility-report`** – Run the Eligibility Engine (`ELIGIBILITY_ENGINE_URL`) to compute program eligibility and required forms.
4. **Digital signature & submission** – Hooks exist after form filling for optional signing and external submission.
5. **GET `/api/status/:caseId`** – Fetch case status, analyzer fields, eligibility results and generated documents for the applicant dashboard.

All service calls exchange JSON payloads, are logged, and bubble up descriptive errors if a downstream service fails.

Environment variables configuring service locations:

```
AI_ANALYZER_URL=http://localhost:8002
ELIGIBILITY_ENGINE_URL=http://localhost:8002
ELIGIBILITY_ENGINE_PATH=/check
AI_AGENT_URL=https://ai-agent:5001
```

The eligibility engine is expected to expose a `POST /check` endpoint.

The AI analyzer optionally reads `TESSERACT_CMD` to locate the Tesseract OCR binary
if it isn't on the system `PATH`.

### Case Management API

The frontend interacts with a simpler set of endpoints that manage a user's in‑progress case:

| Endpoint | Method | Description |
| --- | --- | --- |
| `/api/status/:caseId` | GET | Case status, analyzer fields, eligibility results and documents |
| `/api/case/status` | GET | Dev shortcut to fetch the latest case when no `caseId` is known |
| `/api/questionnaire` | POST | Store questionnaire answers and merge with analyzer fields |
| `/api/files/upload` | POST | Upload a single document (fields: `file` and `key`) |
| `/api/eligibility-report` | GET/POST | Fetch or trigger eligibility analysis |

### Questionnaire Payload

`POST /api/case/questionnaire` accepts JSON with the following fields. Numeric strings will be converted to numbers, boolean-like strings are parsed, and dates must be in `dd/MM/YYYY` format.

| Field | Type | Required? | Notes |
| --- | --- | --- | --- |
| businessName | string | yes | |
| phone | string | yes | |
| email | string (email) | yes | valid email format |
| address | string | no | |
| city | string | no | |
| state | string | no | |
| zipCode | string | no | |
| locationZone | string | no | e.g. `urban` |
| serviceAreaPopulation | number | no | population of the area served |
| organizationType | string | no | e.g. `municipality`, `nonprofit` |
| incomeLevel | string | no | `low`, `moderate`, or `high` |
| projectType | string | no | `community_facilities`, `rbdg`, `rcdg`, `redlg` |
| projectCost | number | no | total project budget |
| projectState | string | no | state where project occurs |
| duns | string | no | DUNS registration number |
| sam | boolean/string | no | SAM registration status |
| cageCode | string | no | CAGE code |
| businessType | string | yes | allowed: `Sole`, `Partnership`, `LLC`, `Corporation` |
| incorporationDate | string (date) | yes | format `dd/MM/YYYY` |
| businessEIN | string | no | |
| annualRevenue | number | no | |
| netProfit | number | no | |
| numberOfEmployees | number | no | |
| ownershipPercentage | number (0-100) | no | |
| previousGrants | boolean | no | |

## Running locally

1. Install Node dependencies and start the API server. Dependency versions, including Express 4.18.2, are pinned in `package.json` and `package-lock.json`.
    ```bash
    npm install
    node server/index.js
    ```

2. Start the AI analyzer service
   ```bash
   cd ai-analyzer
   pip install -r requirements.txt
   # optional: specify path to the Tesseract binary
   export TESSERACT_CMD=/usr/bin/tesseract
   python -m uvicorn main:app --port 8002
   ```
3. Start the AI agent service
   ```bash
   cd ai-agent
   pip install -r requirements.txt
   python -m uvicorn main:app --port 5001
   ```
4. Start the eligibility engine
   ```bash
   cd eligibility-engine
   pip install -r requirements.txt
   python -m uvicorn api:app --port 4001
   ```
5. (Optional) Run the eligibility engine tests
   ```bash
   cd eligibility-engine
   python -m pytest
   ```

### Analyzer upload smoke test

1. Start services:
   - Analyzer: `uvicorn main:app --port 8002 --reload` (in `ai-analyzer/`)
   - Server: `npm start` (in `server/`)
   - (Optional) Frontend: `npm run dev` (in `frontend/`)

2. Health checks:
   - Analyzer: `curl http://localhost:8002/healthz` → `{"status":"ok"}`
   - Server:   `curl http://localhost:5000/healthz` → `{"status":"ok"}`

3. Upload a PDF:

   ```bash
   curl -X POST "http://localhost:5000/api/files/upload" \\
     -F "file=@/absolute/path/to/sample.pdf" \\
     -F "caseId=case-local-smoke" \\
     -F "key=Bank Statements"
   ```

   Expected: HTTP 200 with JSON containing `analyzerFields` or at minimum `raw_text_preview`.

The `ai-agent` service can parse free-form notes and uploaded documents, infer missing fields
and provide human readable summaries. Eligibility results now include a `next_steps` field
along with any missing information:

```bash
curl -k -X POST https://localhost:5001/check -H "Content-Type: application/json" \
    -d '{"notes": "We started around 2021 and are women-led in biotech"}'
```

To fill a grant application form, send JSON directly to `/form-fill`:

```bash
curl -k -X POST https://localhost:5001/form-fill \
    -H "Content-Type: application/json" \
    -d '{
        "form_name": "form_8974",
        "user_payload": {
            "employer_identification_number": "12-3456789",
            "name": "Acme Corp"
        }
    }'
```

### Curl examples

```bash
# Upload a document
curl -F "file=@./samples/payroll_q1.pdf" -F "caseId=dev-case-1" \
  http://localhost:5000/api/files/upload

# Trigger eligibility report
curl -X POST -H "Content-Type: application/json" \
  -d '{"caseId":"dev-case-1"}' \
  http://localhost:5000/api/eligibility-report

# Fetch case status
curl http://localhost:5000/api/status/dev-case-1
```

## Frontend

The **frontend/** directory contains a Next.js application used for end-user registration, login and document uploads.

To start the frontend locally:

```bash
cd frontend
npm install # install dependencies (requires internet access)
npm run dev
```

Environment variables should be placed in a `.env.local` file. See `.env.local.example` for the API base URL.
The backend uses `AI_ANALYZER_URL`, `ELIGIBILITY_ENGINE_URL` and `AI_AGENT_URL` to locate the downstream services.

### Testing file uploads

1. Visit [https://localhost:3000](https://localhost:3000) and register or log in.
2. From the dashboard choose **OPEN CASE** and complete the questionnaire wizard.
3. On the **Documents** step upload sample files (PDF, JPG, JPEG or PNG). Use the **Replace** button to update a document.
4. When all documents are uploaded, click **Submit for Analysis** to see eligibility results.

![Dashboard Flow](frontend/public/dashboard-placeholder.svg)
![Document Upload](frontend/public/upload-placeholder.svg)

## Docker Compose

The repository includes a `docker-compose.yml` that spins up all services in one command. This will launch MongoDB, the API server, auxiliary Python services, and the Next.js frontend.

```bash
docker-compose up --build
```

The frontend will be available at [https://localhost:3000](https://localhost:3000) and the API at [https://localhost:5000/api](https://localhost:5000/api).

## Testing

Each microservice includes a small test suite with coverage reporting. Run them individually from the repository root:

```bash
# Express API (coverage written to server/coverage.txt)
cd server && npm test

# Frontend unit tests and E2E (coverage in frontend/coverage)
cd frontend
$env:NEXT_PUBLIC_API_BASE="https://localhost:5000"
npm test
# Or via script (cross-env sets NEXT_PUBLIC_API_BASE)
npm test
npm run e2e:install
npm run e2e

# Python services (coverage.xml output)
cd ai-agent && pip install -r requirements.txt && coverage run -m pytest && coverage report
cd ai-analyzer && pip install -r requirements.txt && coverage run -m pytest && coverage report
cd eligibility-engine && pip install -r requirements.txt && coverage run -m pytest && coverage report
```

### Linting and Coverage

Run `npm run lint` in the `frontend` folder and `flake8 .` within each Python service to perform static analysis. Coverage results are written per service (e.g., `server/coverage.txt`, `frontend/coverage`, `ai-agent/coverage.xml`) and the CI workflow aggregates them via Codecov.

Continuous integration runs these commands on every push and pull request using the workflow in `.github/workflows/ci.yml`.

When contributing new features, add tests in the corresponding service and keep test imports local to that service.
