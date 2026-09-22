"""Contract tests for the machine endpoints as the firmware actually calls them.

These lock in the exact request shapes the ESP32 sends: no ``/api/v1`` prefix, no
``idempotency-key`` header, camelCase bodies. Each of those mismatches has broken
the simulator in production, so they are pinned here rather than left to a live
run to discover.
"""

import inspect

from conserve_naija.api.machine import submit_measurement


def _headers_param() -> inspect.Parameter:
    return inspect.signature(submit_measurement).parameters["idempotency_key"]


def test_idempotency_key_header_is_optional() -> None:
    """The firmware sends no idempotency-key; requiring it returned 422."""
    param = _headers_param()
    assert param.default.default is None, "header must default to None"


def test_idempotency_key_header_has_no_length_floor() -> None:
    """min_length would still reject an absent header."""
    param = _headers_param()
    assert getattr(param.default, "min_length", None) is None


def test_telemetry_accepts_the_firmwares_nested_location() -> None:
    """The firmware sends {"location": {...}}, which must not be dropped."""
    from conserve_naija.api.schemas import TelemetryRequest

    request = TelemetryRequest.model_validate(
        {
            "location": {"latitude": 6.5095, "longitude": 3.3711},
            "bins": [{"material": "plastic", "weightKg": 20.0, "fillPercent": 40}],
        }
    )
    assert request.resolved_latitude == 6.5095
    assert request.resolved_longitude == 3.3711


def test_telemetry_accepts_flat_coordinates_too() -> None:
    from conserve_naija.api.schemas import TelemetryRequest

    request = TelemetryRequest.model_validate(
        {
            "latitude": 1.5,
            "longitude": 2.5,
            "bins": [{"material": "plastic", "weight_kg": 1.0}],
        }
    )
    assert request.resolved_latitude == 1.5
    assert request.resolved_longitude == 2.5
