# ENV VALIDATION: centralized env settings for ai-analyzer
import os
from pathlib import Path
from typing import Optional
from pydantic import BaseSettings

if os.environ.get("NODE_ENV") != "production":
    print("🔹 Development mode – loading .env manually")
    try:
        with open(".env") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#"):
                    key, value = line.split("=", 1)
                    os.environ[key.strip()] = value.strip()
    except FileNotFoundError:
        print("⚠️ .env file not found – continuing with existing environment variables")
else:
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
        case_sensitive = True

settings = Settings()
if settings.NODE_ENV == "production":
    assert settings.TLS_CERT_PATH and settings.TLS_CERT_PATH.exists(), "Missing TLS_CERT_PATH"
    assert settings.TLS_KEY_PATH and settings.TLS_KEY_PATH.exists(), "Missing TLS_KEY_PATH"
