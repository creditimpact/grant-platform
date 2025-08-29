# Findings

- AI Agent and Analyzer URLs include a trailing space when constructed in server logs, causing Undici URL parse errors and 502 responses during file upload and form-fill.
- README sets ELIGIBILITY_ENGINE_URL to 8002 in one section, but service actually runs on 4001; server config defaults and tests also assume 4001.
- server/config/env.js defaults PORT=3000 and AI_AGENT_URL=http://localhost:9001, diverging from README/docker (5000, 5001).
- SKIP_DB=true intended for in-memory store was not honored in our server launch via cmd; dotenv loaded .env.development and server still connected to MongoDB.
- Request logging uses morgan + custom JSON logger with masking; preview logs confirm mapping of projectTitle to descriptive_title and auto-date formatting, but descriptive_title shows unexpected hashed-like value in logs (masking heuristic may be over-broad).
- E2E flow succeeded up to eligibility-report; agent form-fill failed due to agent URL parse (whitespace), so no PDFs were generated.
- MongoDB collections present: pipelinecases, formtemplates; pipelinecases documents include analyzer fields, questionnaire, eligibility, but generatedForms empty due to agent failure.
