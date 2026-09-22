"""End-to-end smoke test for the Conserve Naija recycling loop.

Exercises authentication, the browser-versus-machine trust boundary, the
Conserve OTP handshake, and reward calculation against a running backend::

    uv run python scripts/smoke_flow.py --admin-email you@example.com

Exits with a non-zero status if any expectation fails, so it can be wired into
a deployment check.
"""

import argparse
import sys
import time

import httpx

DEVICE_HEADERS = {"Authorization": "Device cn-dev-yaba-device-key"}
DEFAULT_PASSWORD = "smoke-password-123"
PLASTIC_GRAMS = 2_500
GLASS_GRAMS = 1_000
EXPECTED_POINTS = 290


class SmokeFailure(AssertionError):
    """Raised when an expectation does not hold."""


def check(label: str, actual: object, expected: object) -> None:
    marker = "PASS" if actual == expected else "FAIL"
    print(
        f"[{marker}] {label}: {actual!r}"
        + ("" if actual == expected else f" (expected {expected!r})")
    )
    if actual != expected:
        raise SmokeFailure(label)


def authenticate(
    client: httpx.Client, email: str, password: str, display_name: str
) -> dict[str, str]:
    """Sign up, or sign in when the account already exists."""
    response = client.post(
        "/api/v1/auth/sign-up",
        json={"display_name": display_name, "email": email, "password": password},
    )
    if response.status_code == 409:
        response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    response.raise_for_status()
    return {"Authorization": f"Bearer {response.json()['token']}"}


def run(client: httpx.Client, admin_email: str, password: str) -> None:
    stamp = int(time.time())

    check("health", client.get("/health").status_code, 200)

    # --- authentication ---------------------------------------------------
    admin = authenticate(client, admin_email, password, "Platform Admin")
    profile = client.get("/api/v1/auth/me", headers=admin).json()
    check("configured admin is_admin", profile["is_admin"], True)
    check("admin holds admin role", "admin" in profile["roles"], True)
    check("admin is org admin", profile["organisations"][0]["role"], "admin")
    organisation_id = profile["organisations"][0]["id"]

    member_email = f"smoke-member-{stamp}@conserve.local"
    member = authenticate(client, member_email, password, "Smoke Member")
    member_profile = client.get("/api/v1/auth/me", headers=member).json()
    check("regular user is not admin", member_profile["is_admin"], False)

    # --- organisation membership -----------------------------------------
    check(
        "member cannot list org members",
        client.get(f"/api/v1/organisations/{organisation_id}/members", headers=member).status_code,
        403,
    )
    check(
        "admin can list org members",
        client.get(f"/api/v1/organisations/{organisation_id}/members", headers=admin).status_code,
        200,
    )
    check(
        "admin adds member",
        client.post(
            f"/api/v1/organisations/{organisation_id}/members",
            json={"email": member_email, "role": "member"},
            headers=admin,
        ).status_code,
        201,
    )
    check(
        "duplicate membership rejected",
        client.post(
            f"/api/v1/organisations/{organisation_id}/members",
            json={"email": member_email, "role": "member"},
            headers=admin,
        ).status_code,
        409,
    )
    check(
        "unknown email rejected",
        client.post(
            f"/api/v1/organisations/{organisation_id}/members",
            json={"email": f"missing-{stamp}@conserve.local", "role": "member"},
            headers=admin,
        ).status_code,
        404,
    )
    check(
        "member now sees the organisation",
        len(client.get("/api/v1/auth/me", headers=member).json()["organisations"]),
        1,
    )
    check(
        "admin cannot remove self",
        client.delete(
            f"/api/v1/organisations/{organisation_id}/members/{profile['user_id']}",
            headers=admin,
        ).status_code,
        409,
    )

    # --- trust boundary ---------------------------------------------------
    check(
        "browser cannot submit a weight",
        client.post(
            "/api/v1/recycling-sessions", json={"weight_kg": 2.5}, headers=member
        ).status_code,
        422,
    )

    # --- recycling mission ------------------------------------------------
    session = client.post("/api/v1/recycling-sessions", json={}, headers=member).json()
    session_id, otp = session["id"], session["otp"]
    check("mission waits for machine", session["status"], "waiting_for_machine")
    check("Conserve OTP is six digits", len(otp), 6)

    claimed = client.post(
        "/api/v1/iot/devices/me/sessions/claim", json={"code": otp}, headers=DEVICE_HEADERS
    )
    check("machine claims session", claimed.json()["status"], "connected")
    check(
        "machine reports sorting",
        client.post(
            f"/api/v1/iot/devices/me/sessions/{session_id}/progress",
            json={"stage": "sorting"},
            headers=DEVICE_HEADERS,
        ).json()["status"],
        "sorting",
    )

    payload = {
        "fractions": [
            {"material": "plastic", "weight_kg": PLASTIC_GRAMS / 1000},
            {"material": "glass", "weight_kg": GLASS_GRAMS / 1000},
        ]
    }
    key = f"smoke-{stamp}"
    deposit = client.post(
        f"/api/v1/iot/devices/me/sessions/{session_id}/measurement",
        json=payload,
        headers={**DEVICE_HEADERS, "idempotency-key": key},
    )
    check("deposit confirmed", deposit.status_code, 200)
    check(
        "reward is backend calculated",
        deposit.json()["conservePoints"],
        EXPECTED_POINTS,
    )

    replay = client.post(
        f"/api/v1/iot/devices/me/sessions/{session_id}/measurement",
        json=payload,
        headers={**DEVICE_HEADERS, "idempotency-key": key},
    )
    check(
        "machine retry is idempotent",
        replay.json()["depositId"],
        deposit.json()["depositId"],
    )
    check("retry does not double award", replay.json()["conservePoints"], EXPECTED_POINTS)
    check(
        "Conserve OTP is single use",
        client.post(
            "/api/v1/iot/devices/me/sessions/claim", json={"code": otp}, headers=DEVICE_HEADERS
        ).status_code,
        409,
    )
    check(
        "session completed",
        client.get(f"/api/v1/recycling-sessions/{session_id}", headers=member).json()["status"],
        "completed",
    )
    check("public site listed", len(client.get("/api/v1/sites").json()) >= 1, True)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:8080")
    parser.add_argument("--admin-email", required=True, help="Must be listed in ADMIN_EMAILS")
    parser.add_argument("--password", default=DEFAULT_PASSWORD)
    args = parser.parse_args()

    with httpx.Client(base_url=args.base_url, timeout=20) as client:
        try:
            run(client, args.admin_email, args.password)
        except SmokeFailure as failure:
            print(f"\nSmoke test failed: {failure}")
            return 1
        except httpx.HTTPError as error:
            print(f"\nSmoke test could not reach the API: {error}")
            return 1

    print("\nAll smoke checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
