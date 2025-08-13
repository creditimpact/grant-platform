from pydantic import BaseSettings
from typing import Tuple

class SecuritySettings(BaseSettings):
    SECURITY_ENFORCEMENT_LEVEL: str = "dev"
    DISABLE_VAULT: bool = True
    AGENT_API_KEY: str | None = None
    AGENT_NEXT_API_KEY: str | None = None
    ELIGIBILITY_ENGINE_API_KEY: str | None = None
    ELIGIBILITY_ENGINE_NEXT_API_KEY: str | None = None
    AI_ANALYZER_API_KEY: str | None = None
    AI_ANALYZER_NEXT_API_KEY: str | None = None

    class Config:
        env_file = ".env"
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
