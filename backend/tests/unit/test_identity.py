"""Tests for configuration parsing and admin identity rules."""

import pytest

from conserve_naija.services.identity import is_configured_admin


def test_admin_emails_accepts_comma_separated(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ADMIN_EMAILS", "one@example.com, two@example.com")
    from conserve_naija.config import Settings

    settings = Settings()
    assert settings.admin_emails == ["one@example.com", "two@example.com"]


def test_admin_emails_accepts_json_array(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ADMIN_EMAILS", '["three@example.com"]')
    from conserve_naija.config import Settings

    settings = Settings()
    assert settings.admin_emails == ["three@example.com"]


def test_admin_emails_empty_by_default(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("ADMIN_EMAILS", raising=False)
    from conserve_naija.config import Settings

    assert Settings().admin_emails == []


def test_configured_admin_matching_is_case_insensitive(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ADMIN_EMAILS", "IsaacOmenuche@Gmail.com")
    from conserve_naija import config

    config.get_settings.cache_clear()
    try:
        assert is_configured_admin("isaacomenuche@gmail.com")
        assert not is_configured_admin("someone-else@example.com")
    finally:
        config.get_settings.cache_clear()
