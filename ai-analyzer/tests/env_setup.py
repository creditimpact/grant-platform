# ENV VALIDATION: helper to set env vars for ai-analyzer tests
import os
from pathlib import Path

dummy = Path(__file__).resolve()
vars = {
    "AI_ANALYZER_API_KEY": "test-key",
    "TLS_CERT_PATH": str(dummy),
    "TLS_KEY_PATH": str(dummy),
    "SECURITY_ENFORCEMENT_LEVEL": "dev",
    "DISABLE_VAULT": "true",
}
for k,v in vars.items():
    os.environ.setdefault(k, v)
