from pydantic import BaseSettings
from typing import Tuple

class SecuritySettings(BaseSettings):
    class Config:
        env_file = ".env.development"
        env_file_encoding = "utf-8"
        case_sensitive = True

def load_security_settings() -> Tuple[SecuritySettings, bool]:
    settings = SecuritySettings()
    return settings, True
