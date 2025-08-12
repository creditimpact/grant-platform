# ENV VALIDATION: centralized env settings for ai-agent
from pydantic import BaseSettings, AnyUrl, FilePath

# ``common`` lives one directory above this service.  When tests import the
# configuration module directly (without the path adjustments performed in
# ``main.py``) the parent directory may not be on ``sys.path`` which would
# cause the import of ``common.vault`` to fail.  Add it dynamically as a
# fallback so the settings module remains self-contained.
from pathlib import Path
import sys

PARENT = Path(__file__).resolve().parent.parent
if str(PARENT) not in sys.path:
    sys.path.insert(0, str(PARENT))

from common.vault import load_vault_secrets

# Load secrets from Vault before settings are evaluated
load_vault_secrets()

class Settings(BaseSettings):
    AI_AGENT_API_KEY: str
    AI_AGENT_NEXT_API_KEY: str | None = None
    OPENAI_API_KEY: str
    MONGO_URI: AnyUrl
    MONGO_USER: str
    MONGO_PASS: str
    MONGO_CA_FILE: FilePath
    MONGO_AUTH_DB: str = "admin"
    TLS_CERT_PATH: FilePath
    TLS_KEY_PATH: FilePath
    TLS_CA_PATH: FilePath | None = None
    ENABLE_DEBUG: bool = False

    class Config:
        case_sensitive = True

settings = Settings()
