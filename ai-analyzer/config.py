# ENV VALIDATION: centralized env settings for ai-analyzer
import os
from pathlib import Path
from typing import Optional
from pydantic import BaseSettings

# Determine which env file to load. Order of resolution:
# 1. ENV_FILE if set
# 2. .env.<NODE_ENV> (defaults to .env.development)
#    .env.development is committed and should contain development defaults.
# Production additionally loads secrets from Vault.
NODE_ENV = os.getenv("NODE_ENV", "development")
ENV_FILE = os.getenv("ENV_FILE")
ENV_PATH = ENV_FILE or Path(__file__).resolve().parent / f".env.{NODE_ENV}"
if NODE_ENV == "production":
    from common.vault import load_vault_secrets

    load_vault_secrets()

class Settings(BaseSettings):
    NODE_ENV: str = "development"
    AI_ANALYZER_API_KEY: str
    AI_ANALYZER_NEXT_API_KEY: str | None = None
    TLS_CERT_PATH: Optional[Path] = None
    TLS_KEY_PATH: Optional[Path] = None
    TLS_CA_PATH: Optional[Path] = None

    class Config:
        env_file = ENV_PATH
        env_file_encoding = "utf-8"
        case_sensitive = True

settings = Settings()
if settings.NODE_ENV == "production":
    assert settings.TLS_CERT_PATH and settings.TLS_CERT_PATH.exists(), "Missing TLS_CERT_PATH"
    assert settings.TLS_KEY_PATH and settings.TLS_KEY_PATH.exists(), "Missing TLS_KEY_PATH"
