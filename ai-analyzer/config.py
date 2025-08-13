# ENV VALIDATION: centralized env settings for ai-analyzer
from dotenv import load_dotenv
import os
from pydantic import BaseSettings, FilePath

load_dotenv()

if os.environ.get("NODE_ENV") != "production":
    print("🔹 Development mode – skipping Vault and TLS")
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
