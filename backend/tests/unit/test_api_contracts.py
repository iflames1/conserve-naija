import pytest
from pydantic import ValidationError

from conserve_naija.api.schemas import MeasurementRequest, StartSessionRequest


def test_start_session_request_has_no_client_result_fields() -> None:
    with pytest.raises(ValidationError):
        StartSessionRequest(weight_kg=2.5)


def test_measurement_requires_machine_fractions_and_rejects_rewards() -> None:
    with pytest.raises(ValidationError):
        MeasurementRequest(
            fractions=[{"material": "plastic", "weight_kg": 2.5, "conserve_points": 250}]
        )
