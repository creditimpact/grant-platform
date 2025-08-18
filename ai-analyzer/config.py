# ENV VALIDATION: centralized env settings for ai-analyzer
import os
from pathlib import Path
from pydantic_settings import BaseSettings

# Determine which env file to load. Order of resolution:
# 1. ENV_FILE if set
# 2. .env.<NODE_ENV> (defaults to .env.development)
#    .env.development is committed and should contain development defaults.
NODE_ENV = os.getenv("NODE_ENV", "development")
ENV_FILE = os.getenv("ENV_FILE")
ENV_PATH = ENV_FILE or Path(__file__).resolve().parent / f".env.{NODE_ENV}"
class Settings(BaseSettings):
    NODE_ENV: str = "development"

    class Config:
        env_file = ENV_PATH
        env_file_encoding = "utf-8"
        case_sensitive = True

settings = Settings()
