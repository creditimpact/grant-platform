# ENV VALIDATION: centralized env settings for ai-analyzer
import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

# Determine which env file to load. Order of resolution:
# 1. ENV_FILE if set
# 2. .env.<NODE_ENV> (defaults to .env.development)
#    .env.development is committed and should contain development defaults.
NODE_ENV = os.getenv("NODE_ENV", "development")
ENV_FILE = os.getenv("ENV_FILE")
ENV_PATH = ENV_FILE or Path(__file__).resolve().parent / f".env.{NODE_ENV}"
class Settings(BaseSettings):
    NODE_ENV: str = "development"
    MAX_FILE_SIZE_MB: int = 5
    MAX_TEXT_LEN: int = 100_000
    ENABLE_SECONDARY_FIELDS: bool = True
    TESSERACT_CMD: str | None = None

    model_config = SettingsConfigDict(env_file=ENV_PATH, extra="ignore")

settings = Settings()
