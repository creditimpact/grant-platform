# Env Matrix

| Variable | Actual | Expected | Status |
|---|---|---|---|
| ELIGIBILITY_ENGINE_PATH | /check | /check | OK |
| NODE_ENV | development | development | OK |
| MONGO_URI | mongodb://localhost:27017/test | mongodb://localhost:27017/grant-platform | Mismatch |
| AI_ANALYZER_URL | http://localhost:8002 | http://localhost:8002 | OK |
| TESSERACT_CMD | (unset) | (unset) | OK |
| ELIGIBILITY_ENGINE_URL | http://localhost:4001 | http://localhost:4001 | OK |
| AI_AGENT_URL | http://localhost:5001 | http://localhost:5001 | OK |
| PROCESS_TEST_MODE | false | (unset=false) | Mismatch |
| PORT | 5050 | 5000 | Mismatch |

Notes:
- server/config/env.js defaults PORT to 3000 and AI_AGENT_URL to 9001, but README/docker use 5000 and 5001.
- Analyzer URL whitespace observed in logs may indicate trailing spaces in env file (see server-log.txt).
