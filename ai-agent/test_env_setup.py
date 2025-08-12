# ENV VALIDATION: helper to set required env vars for tests
import os
from pathlib import Path

dummy = Path(__file__).resolve()
vars = {
    "AI_AGENT_API_KEY": "test-key",
    "ELIGIBILITY_ENGINE_API_KEY": "test-key",
    "OPENAI_API_KEY": "test-openai",
    "MONGO_URI": "mongodb://localhost:27017", 
    "MONGO_USER": "u",
    "MONGO_PASS": "p",
    "MONGO_CA_FILE": str(dummy),
    "TLS_CERT_PATH": str(dummy),
    "TLS_KEY_PATH": str(dummy),
}
for k, v in vars.items():
    os.environ[k] = v
import sys
sys.modules.pop("config", None)
