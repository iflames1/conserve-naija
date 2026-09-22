"""Smoke tests proving the application imports and serves its liveness probe."""

from fastapi.testclient import TestClient

from conserve_naija.main import create_app


def test_health_reports_ok() -> None:
    with TestClient(create_app()) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"
