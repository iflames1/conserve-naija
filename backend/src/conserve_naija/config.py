"""Runtime configuration, sourced from the environment."""

import json
from functools import lru_cache
from typing import Annotated, Any

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


def _as_list(value: Any) -> Any:
    """Accept either a JSON array or a comma-separated string for list settings."""
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return []
        if text.startswith("["):
            return json.loads(text)
        return [item.strip() for item in text.split(",") if item.strip()]
    return value


class Settings(BaseSettings):
    """Application settings.

    Every value is overridable through an environment variable so deployments
    can be configured without code changes.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="",
        extra="ignore",
    )

    app_name: str = "Conserve Naija"
    environment: str = "local"
    database_url: str = "postgresql+asyncpg://conserve:conserve@localhost:5433/conserve_naija"
    jwt_secret: str = "local-development-secret-change-me"
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:3000"]
    admin_emails: Annotated[list[str], NoDecode] = []

    @field_validator("cors_origins", "admin_emails", mode="before")
    @classmethod
    def _parse_list(cls, value: Any) -> Any:
        return _as_list(value)

    @field_validator("admin_emails", mode="after")
    @classmethod
    def _normalise_admin_emails(cls, value: list[str]) -> list[str]:
        return sorted({email.strip().lower() for email in value if email.strip()})


@lru_cache
def get_settings() -> Settings:
    """Return the process-wide settings instance."""
    return Settings()
