# ENV VALIDATION: centralized env settings for ai-agent
from pydantic import BaseSettings, AnyUrl, FilePath, Field
import os

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

# Determine which env file to load. Order of resolution:
# 1. ENV_FILE if set
# 2. .env.<NODE_ENV> (defaults to .env.development)
#    .env.development is checked into source control and should contain
#    defaults for local development.
# Production additionally loads secrets from Vault.
NODE_ENV = os.getenv("NODE_ENV", "development")
ENV_FILE = os.getenv("ENV_FILE")
ENV_PATH = ENV_FILE or Path(__file__).resolve().parent / f".env.{NODE_ENV}"
if NODE_ENV == "production":
    from common.vault import load_vault_secrets

    load_vault_secrets()

class Settings(BaseSettings):
    AI_AGENT_API_KEY: str
    AI_AGENT_NEXT_API_KEY: str | None = None
    OPENAI_API_KEY: str
    MONGO_URI: AnyUrl
    MONGO_USER: str | None = Field(
        default=None, description="MongoDB username; optional for development"
    )
    MONGO_PASS: str | None = Field(
        default=None, description="MongoDB password; optional for development"
    )
    MONGO_CA_FILE: FilePath | None = None
    MONGO_AUTH_DB: str = "admin"
    TLS_CERT_PATH: FilePath | None = None
    TLS_KEY_PATH: FilePath | None = None
    TLS_CA_PATH: FilePath | None = None
    ENABLE_DEBUG: bool = False

    class Config:
        env_file = ENV_PATH
        env_file_encoding = "utf-8"
        case_sensitive = True

settings = Settings()

if NODE_ENV == "production":
    required = ["TLS_CERT_PATH", "TLS_KEY_PATH", "MONGO_CA_FILE"]
    missing = [name for name in required if getattr(settings, name) is None]
    if missing:
        raise ValueError(
            f"Missing required settings in production: {', '.join(missing)}"
        )
