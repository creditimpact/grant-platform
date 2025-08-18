# ENV VALIDATION: centralized env settings for ai-agent
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import AnyUrl, FilePath, Field
import os

# ``common`` lives one directory above this service. When tests import the
# configuration module directly (without the path adjustments performed in
# ``main.py``) the parent directory may not be on ``sys.path``. Add it
# dynamically so the settings module remains self-contained.
from pathlib import Path
import sys

PARENT = Path(__file__).resolve().parent.parent
if str(PARENT) not in sys.path:
    sys.path.insert(0, str(PARENT))

# Determine which env file to load. Order of resolution:
# 1. ENV_FILE if set
# 2. .env.<NODE_ENV> (defaults to .env.development)
#    .env.development is checked into source control and should contain
#    defaults for local development.
NODE_ENV = os.getenv("NODE_ENV", "development")
ENV_FILE = os.getenv("ENV_FILE")
ENV_PATH = ENV_FILE or Path(__file__).resolve().parent / f".env.{NODE_ENV}"

class Settings(BaseSettings):
    OPENAI_API_KEY: str | None = None
    MONGO_URI: AnyUrl | None = None
    ENABLE_DEBUG: bool = False

    model_config = SettingsConfigDict(env_file=ENV_PATH, extra="ignore")

settings = Settings()
