from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Load from .env and ignore unknown env vars
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Known settings
    NODE_ENV: str = "development"
    MONGO_URI: str = "mongodb://localhost:27017/grant-platform"
    WRAP_RESULTS: bool = True


settings = Settings()

