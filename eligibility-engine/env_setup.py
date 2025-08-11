# ENV VALIDATION: helper for eligibility-engine tests
import os
from pathlib import Path

dummy = Path(__file__).resolve()
vars = {
    "INTERNAL_API_KEY": "test-key",
    "TLS_CERT_PATH": str(dummy),
    "TLS_KEY_PATH": str(dummy),
}
for k,v in vars.items():
    os.environ.setdefault(k, v)
