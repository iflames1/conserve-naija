import pytest
from pydantic import ValidationError

from conserve_naija.api.schemas import (
    MachineDepositResult,
    MeasurementRequest,
    StartSessionRequest,
    TelemetryRequest,
)


def test_start_session_request_has_no_client_result_fields() -> None:
    with pytest.raises(ValidationError):
        StartSessionRequest(weight_kg=2.5)


def test_measurement_requires_machine_fractions_and_rejects_rewards() -> None:
    with pytest.raises(ValidationError):
        MeasurementRequest(
            fractions=[{"material": "plastic", "weight_kg": 2.5, "conserve_points": 250}]
        )


def test_measurement_accepts_the_machines_camel_case_payload() -> None:
    """The ESP32 firmware sends weightKg; rejecting it broke every deposit."""
    request = MeasurementRequest.model_validate(
        {"fractions": [{"material": "plastic", "weightKg": 2.5}]}
    )
    assert request.fractions[0].weight_kg == 2.5


def test_measurement_still_accepts_snake_case() -> None:
    request = MeasurementRequest.model_validate(
        {"fractions": [{"material": "plastic", "weight_kg": 2.5}]}
    )
    assert request.fractions[0].weight_kg == 2.5


def test_telemetry_accepts_the_machines_camel_case_bins() -> None:
    request = TelemetryRequest.model_validate(
        {"bins": [{"material": "plastic", "weightKg": 12.0, "fillPercent": 40}]}
    )
    assert request.bins[0].weight_kg == 12.0
    assert request.bins[0].fill_percent == 40


def test_machine_deposit_result_replies_in_the_machines_case() -> None:
    """The firmware reads conservePoints, so the reply must not be snake_case."""
    payload = MachineDepositResult.model_validate(
        {
            "deposit_id": "11111111-1111-1111-1111-111111111111",
            "conserve_points": 290,
            "fractions": [{"material": "plastic", "weight_grams": 2500, "conserve_points": 250}],
            "status": "confirmed",
        }
    ).model_dump(by_alias=True)

    assert payload["conservePoints"] == 290
    assert str(payload["depositId"]) == "11111111-1111-1111-1111-111111111111"
    assert payload["fractions"][0]["weightGrams"] == 2500
