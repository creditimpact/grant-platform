# Grant AI Platform Backend

This repository contains three microservices used to test a grant eligibility workflow.

- **server/** – Express API for authentication, file uploads and analysis forwarding
- **ai-analyzer/** – FastAPI service that performs stub OCR/NLP processing
- **eligibility-engine/** – Pure Python rules engine for grant logic

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
   python engine.py
   ```
