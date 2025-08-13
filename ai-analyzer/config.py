# ENV VALIDATION: centralized env settings for ai-analyzer
import os
from pydantic import BaseSettings, FilePath

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
    AI_ANALYZER_API_KEY: str
    AI_ANALYZER_NEXT_API_KEY: str | None = None
    TLS_CERT_PATH: FilePath
    TLS_KEY_PATH: FilePath
    TLS_CA_PATH: FilePath | None = None

    class Config:
        case_sensitive = True

settings = Settings()
