# ENV VALIDATION: centralized env settings for ai-agent
from pathlib import Path
from pydantic import BaseSettings, AnyUrl, FilePath

class Settings(BaseSettings):
    INTERNAL_API_KEY: str
    OPENAI_API_KEY: str
    MONGO_URI: AnyUrl
    MONGO_USER: str
    MONGO_PASS: str
    MONGO_CA_FILE: FilePath
    MONGO_AUTH_DB: str = "admin"
    TLS_CERT_PATH: FilePath
    TLS_KEY_PATH: FilePath
    TLS_CA_PATH: FilePath | None = None
    ENABLE_DEBUG: bool = False

    class Config:
        env_file = Path(__file__).resolve().parent / ".env"
        case_sensitive = True

settings = Settings()
