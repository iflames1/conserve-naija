"""Runtime configuration, sourced from the environment."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings.

    Every value is overridable through a ``CN_``-prefixed environment variable so
    deployments can be configured without code changes.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="CN_",
        extra="ignore",
    )

    app_name: str = "Conserve Naija"
    environment: str = "local"
    database_url: str = "postgresql+asyncpg://conserve:conserve@localhost:5432/conserve_naija"
    jwt_secret: str = "local-development-secret-change-me"
    cors_origins: list[str] = ["http://localhost:3000"]


@lru_cache
def get_settings() -> Settings:
    """Return the process-wide settings instance."""
    return Settings()
