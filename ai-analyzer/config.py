# ENV VALIDATION: centralized env settings for ai-analyzer
from pathlib import Path
from pydantic import BaseSettings, FilePath

class Settings(BaseSettings):
    AI_ANALYZER_API_KEY: str
    AI_ANALYZER_NEXT_API_KEY: str | None = None
    TLS_CERT_PATH: FilePath
    TLS_KEY_PATH: FilePath
    TLS_CA_PATH: FilePath | None = None

    class Config:
        env_file = Path(__file__).resolve().parent / ".env"
        case_sensitive = True

settings = Settings()
