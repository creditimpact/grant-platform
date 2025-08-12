# ENV VALIDATION: centralized env settings for eligibility-engine
from pydantic import BaseSettings, FilePath
from common.vault import load_vault_secrets

# Load secrets from Vault before settings are evaluated
load_vault_secrets()

class Settings(BaseSettings):
    ELIGIBILITY_ENGINE_API_KEY: str
    ELIGIBILITY_ENGINE_NEXT_API_KEY: str | None = None
    TLS_CERT_PATH: FilePath
    TLS_KEY_PATH: FilePath
    TLS_CA_PATH: FilePath | None = None

    class Config:
        case_sensitive = True

settings = Settings()
