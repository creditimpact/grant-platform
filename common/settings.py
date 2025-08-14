from pydantic import BaseSettings
from typing import Tuple
import os

# Determine env file: ENV_FILE > .env.<NODE_ENV> (defaults to .env.development).
# .env.development should contain shared development defaults.
ENV_FILE = os.getenv("ENV_FILE") or f".env.{os.getenv('NODE_ENV', 'development')}"

class SecuritySettings(BaseSettings):
    SECURITY_ENFORCEMENT_LEVEL: str = "dev"
    DISABLE_VAULT: bool = True
    AI_AGENT_API_KEY: str | None = None
    AI_AGENT_NEXT_API_KEY: str | None = None
    ELIGIBILITY_ENGINE_API_KEY: str | None = None
    ELIGIBILITY_ENGINE_NEXT_API_KEY: str | None = None
    AI_ANALYZER_API_KEY: str | None = None
    AI_ANALYZER_NEXT_API_KEY: str | None = None

    class Config:
        env_file = ENV_FILE
        env_file_encoding = "utf-8"
        case_sensitive = True


def load_security_settings() -> Tuple[SecuritySettings, bool]:
    from common.vault import load_vault_secrets

    settings = SecuritySettings()
    ready = True
    if settings.SECURITY_ENFORCEMENT_LEVEL == "prod" and not settings.DISABLE_VAULT:
        try:
            load_vault_secrets()
            settings = SecuritySettings()
        except Exception:
            ready = False
    return settings, ready
