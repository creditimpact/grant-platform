# SYSTEM DIAGNOSIS

## Executive Summary
- Core services are up and healthy on localhost: server (5050), eligibility-engine (4001), ai-agent (5001), ai-analyzer (8002).
- End-to-end flow runs through eligibility calculation but fails at form-fill and file upload due to whitespace in downstream service URLs, causing 502 errors.
- MongoDB is connected and stores cases; generated forms are empty because agent form-fill failed.
- Environment defaults are inconsistent across README, docker-compose, and server/config/env.js (ports and URLs).

## Architecture
See ASCII diagram in diagnostics/architecture.txt.

## Environment Variables & Configuration Matrix
See diagnostics/env-matrix.md. Key inconsistencies:
- server/config/env.js defaults PORT=3000 and AI_AGENT_URL=http://localhost:9001, while README/docker use 5000/5001.
- README lists ELIGIBILITY_ENGINE_URL=http://localhost:8002 in one spot, but engine actually runs on 4001.

## Running Services & Health Checks
- Ports and PIDs: diagnostics/services.json
- Health: diagnostics/healthchecks.md
- Network reachability: diagnostics/network.md

## API Contracts vs. Actual Requests
- Exported OpenAPI specs in diagnostics/api-contracts/*.openapi.json
- Observed requests in diagnostics/server-log.txt (eligibility_engine_request, form_fill_inputs_preview, form_fill_payload_preview)
Findings:
- Server -> AI Agent URL built as "http://localhost:5001 /form-fill" (note space) leading to Undici URL parse error.
- Server -> AI Analyzer URL built as "http://localhost:8002 /analyze" (space) during file upload; returns 502.

## End-to-End Request Flow
- Detailed run with responses: diagnostics/e2e-run.md
- Correlated logs: diagnostics/server-log.txt
Highlights:
- RequestIds seen across steps (e.g., 03db45e4-..., 550b496a-..., 652fd24e4-..., 20096483-...).
- projectTitle provided ("Cancer Biomarker Toolkit"). In form_fill_payload_preview, descriptive_title is present but appears as a hashed-like token in logs; dates normalized to MM/DD/YYYY.
- eligibility-report succeeded; generatedForms empty due to agent call failure.

## MongoDB Collections & Samples
See diagnostics/mongo.md.
- Collections: pipelinecases, formtemplates
- Sample pipelinecases document shows analyzer fields, questionnaire data, eligibility results, requiredDocuments; generatedForms empty.

## Findings: Root Causes, Risks, Inconsistencies
See diagnostics/findings.md for full list. Top issues:
- Trailing whitespace in downstream service base URLs at runtime causes URL parse errors.
- Documentation and defaults disagree on ports/URLs (PORT, AI_AGENT_URL, ELIGIBILITY_ENGINE_URL).
- SKIP_DB behavior inconsistent under dotenv loading, resulting in a live DB connection during a supposed in-memory run.

## Appendices
- Services: diagnostics/services.json
- Env matrix: diagnostics/env-matrix.md
- Health checks: diagnostics/healthchecks.md
- API contracts: diagnostics/api-contracts/
- Server logs: diagnostics/server-log.txt
- Network: diagnostics/network.md
- Mongo: diagnostics/mongo.md
- E2E run: diagnostics/e2e-run.md
- Findings: diagnostics/findings.md
