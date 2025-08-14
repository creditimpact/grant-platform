# ENV VALIDATION: centralized env settings for eligibility-engine
from pydantic import BaseSettings, FilePath
import os
from pathlib import Path
from dotenv import load_dotenv
from common.vault import load_vault_secrets

# Determine which env file to load. Order of resolution:
# 1. ENV_FILE if set
# 2. .env.<NODE_ENV> (defaults to .env.development)
#    .env.development should contain defaults for development.
NODE_ENV = os.getenv("NODE_ENV", "development")
ENV_FILE = os.getenv("ENV_FILE")
ENV_PATH = ENV_FILE or Path(__file__).resolve().parent / f".env.{NODE_ENV}"
load_dotenv(dotenv_path=ENV_PATH)

# Load secrets from Vault only in production
if NODE_ENV == "production":
    load_vault_secrets()

class Settings(BaseSettings):
    ELIGIBILITY_ENGINE_API_KEY: str
    ELIGIBILITY_ENGINE_NEXT_API_KEY: str | None = None
    TLS_CERT_PATH: FilePath
    TLS_KEY_PATH: FilePath
    TLS_CA_PATH: FilePath | None = None

    class Config:
        env_file = ENV_PATH
        env_file_encoding = "utf-8"
        case_sensitive = True

settings = Settings()
