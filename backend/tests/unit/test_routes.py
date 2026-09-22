"""Tests that the machine's real endpoint paths are registered.

The ESP32 firmware calls ``/iot/devices/me/...`` at the server root, with no
``/api/v1`` prefix. These paths were once registered on a router that had
``prefix="/api/v1"``, so every device request returned 404 and the simulator
could never complete a deposit. Registering them without a prefix is the fix;
these tests keep it that way.
"""

from conserve_naija.main import create_app

MACHINE_PATHS = [
    "/iot/devices/me",
    "/iot/devices/me/heartbeat",
    "/iot/devices/me/telemetry",
    "/iot/devices/me/sessions/claim",
    "/iot/devices/me/sessions/{session_id}/progress",
    "/iot/devices/me/sessions/{session_id}/measurement",
]


def _registered_paths() -> set[str]:
    return set(create_app().openapi()["paths"])


def test_machine_paths_are_at_the_server_root() -> None:
    """No /api/v1 prefix: this is what the firmware sends."""
    from conserve_naija.api.machine import router

    registered = {route.path for route in router.routes}
    for path in MACHINE_PATHS:
        assert path in registered, f"machine path missing: {path}"


def test_no_machine_path_sits_under_the_api_prefix() -> None:
    """Guard against the /api/v1 prefix creeping back onto the machine router."""
    from conserve_naija.api.machine import router

    assert router.prefix == ""
    registered = {route.path for route in router.routes}
    assert not any(path.startswith("/api/v1/iot") for path in registered)


def test_canonical_device_paths_are_documented() -> None:
    """New clients get a versioned shape that shows up in the API docs."""
    paths = _registered_paths()
    for path in [
        "/api/v1/device/me",
        "/api/v1/device/heartbeat",
        "/api/v1/device/telemetry",
        "/api/v1/device/sessions/claim",
        "/api/v1/device/sessions/{session_id}/progress",
        "/api/v1/device/sessions/{session_id}/measurement",
    ]:
        assert path in paths, f"canonical path missing: {path}"


def test_citizen_session_paths_are_versioned() -> None:
    paths = _registered_paths()
    assert "/api/v1/recycling-sessions" in paths
    assert "/api/v1/sites" in paths
