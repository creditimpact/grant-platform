# Grant AI Platform Backend

This repository contains three microservices used to test a grant eligibility workflow.

- **server/** – Express API for authentication, file uploads and analysis forwarding
- **ai-analyzer/** – FastAPI service that performs stub OCR/NLP processing
- **eligibility-engine/** – Pure Python rules engine for grant logic
- **ai-agent/** – LLM-ready service with conversational endpoints and smart form filling

```
project-root/
  server/               Express REST API
  ai-agent/             FastAPI form filler and reasoning service
  ai-analyzer/          OCR/NLP stub service
  eligibility-engine/   Core rules engine
  frontend/             Next.js application
```

## Running locally

1. Install Node dependencies and start the API server
   ```bash
   npm install
   node server/index.js
   ```
   Environment variables should be placed in a `.env` file. See `.env.example` for required keys.

2. Start the AI analyzer
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
and provide human readable summaries:

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
