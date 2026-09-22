"""Short-lived, single-use Conserve OTP primitives."""

import hashlib
import secrets
from datetime import UTC, datetime, timedelta

OTP_LENGTH = 6
OTP_TTL = timedelta(minutes=2)


def generate_otp() -> str:
    """Generate a six-digit code, including leading zeroes."""
    return f"{secrets.randbelow(10**OTP_LENGTH):0{OTP_LENGTH}d}"


def hash_otp(code: str) -> str:
    """Hash a code before it is stored or compared."""
    return hashlib.sha256(code.encode("ascii")).hexdigest()


def is_valid_otp(code: str, digest: str, expires_at: datetime, used_at: datetime | None) -> bool:
    """Validate code, expiry, and one-time-use state."""
    now = datetime.now(UTC)
    expiry = expires_at if expires_at.tzinfo else expires_at.replace(tzinfo=UTC)
    return used_at is None and now < expiry and secrets.compare_digest(hash_otp(code), digest)
