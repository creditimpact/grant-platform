# Grant AI Platform Backend

This repository contains three microservices used to test a grant eligibility workflow.

- **server/** – Express API for authentication, file uploads and analysis forwarding
- **ai-analyzer/** – FastAPI service that extracts text using Tesseract OCR and simple NLP with confidence scores
- **eligibility-engine/** – Python rules engine returning missing fields and suggested next steps
- **ai-agent/** – LLM-ready service with conversational endpoints and smart form filling

```
project-root/
  server/               Express REST API
  ai-agent/             FastAPI form filler and reasoning service
  ai-analyzer/          OCR/NLP stub service
  eligibility-engine/   Core rules engine
  frontend/             Next.js application
```

The document upload flow accepts **PDF**, **JPG/JPEG**, and **PNG** files.

## Grant Application Flow

The application now enforces a strict questionnaire and document process:

1. **Questionnaire validation** – Users cannot advance to the next step until all required fields are completed. Inline error messages explain what is missing.
2. **Dynamic document list** – Required documents are generated from questionnaire answers. For example, corporations must provide incorporation certificates and minority-owned businesses are prompted for proof of status. Each document includes a short reason.
3. **Cross-checking uploads** – When a document is uploaded the API compares its filename against key answers (business name, EIN, ownership flags). Mismatches cause the upload to be rejected with a clear error.
4. **Backend enforcement** – The analysis endpoint refuses to run unless all required answers are present and every required document is successfully uploaded.

The dashboard shows any missing documents so applicants know what is still required before submission.

## Running locally

1. Install Node dependencies and start the API server
   ```bash
   npm install
   node server/index.js
   ```
   Environment variables should be placed in a `.env` file. See `.env.example` for required keys.

2. Start the AI analyzer (requires Tesseract installed)
   ```bash
   cd ai-analyzer
   python -m uvicorn main:app --port 8000
   ```

3. Run the eligibility engine tests
   ```bash
   cd eligibility-engine
   python -m pytest
   ```

The `ai-agent` service can parse free-form notes and uploaded documents, infer missing fields
and provide human readable summaries. Eligibility results now include a `next_steps` field
along with any missing information:

```bash
curl -X POST http://localhost:5001/check -H "Content-Type: application/json" \
    -d '{"notes": "We started around 2021 and are women-led in biotech"}'
```

To fill a grant application form, send JSON directly to `/form-fill`:

```bash
curl -X POST http://localhost:5001/form-fill \
    -H "Content-Type: application/json" \
    -d '{
        "form_name": "sba_microloan_form",
        "user_payload": {
            "business_name": "Tech Boosters",
            "annual_revenue": 250000,
            "zipcode": "10001",
            "minority_owned": true
        }
    }'
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
The backend uses `AGENT_URL` which should point to the root of the AI agent service (e.g. `http://localhost:5001`).

## Docker Compose

The repository includes a `docker-compose.yml` that spins up all services in one command. This will launch MongoDB, the API server, auxiliary Python services, and the Next.js frontend.

```bash
docker-compose up --build
```

The frontend will be available at [http://localhost:3000](http://localhost:3000) and the API at [http://localhost:5000/api](http://localhost:5000/api).
