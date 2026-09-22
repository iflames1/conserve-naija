"""Tests for database URL normalisation.

Hosting providers hand out a synchronous ``postgresql://`` URL, which would make
SQLAlchemy load psycopg2 and crash on startup. These tests pin the rewrite that
keeps provider-supplied values usable as-is.
"""

import pytest

from conserve_naija.config import Settings


def _url(monkeypatch: pytest.MonkeyPatch, value: str) -> str:
    monkeypatch.setenv("DATABASE_URL", value)
    return Settings().database_url


@pytest.mark.parametrize(
    "supplied",
    [
        "postgres://user:pw@host:5432/db",
        "postgresql://user:pw@host:5432/db",
        "postgresql+psycopg2://user:pw@host:5432/db",
    ],
)
def test_sync_postgres_urls_are_rewritten_to_asyncpg(
    monkeypatch: pytest.MonkeyPatch, supplied: str
) -> None:
    assert _url(monkeypatch, supplied) == "postgresql+asyncpg://user:pw@host:5432/db"


def test_asyncpg_url_is_left_alone(monkeypatch: pytest.MonkeyPatch) -> None:
    supplied = "postgresql+asyncpg://user:pw@host:5432/db"
    assert _url(monkeypatch, supplied) == supplied


def test_credentials_and_query_are_preserved(monkeypatch: pytest.MonkeyPatch) -> None:
    supplied = "postgresql://user:p%40ss@host:5432/db?sslmode=require"
    assert (
        _url(monkeypatch, supplied)
        == "postgresql+asyncpg://user:p%40ss@host:5432/db?sslmode=require"
    )


def test_non_postgres_urls_are_untouched(monkeypatch: pytest.MonkeyPatch) -> None:
    supplied = "sqlite+aiosqlite:///./local.db"
    assert _url(monkeypatch, supplied) == supplied
