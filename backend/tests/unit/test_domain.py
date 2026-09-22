from datetime import UTC, datetime, timedelta

import pytest

from conserve_naija.domain.otp import generate_otp, hash_otp, is_valid_otp
from conserve_naija.domain.rewards import calculate_reward, grams_from_kg
from conserve_naija.domain.sessions import SessionStatus, can_transition, transition


def test_mixed_fraction_reward_uses_integer_grams() -> None:
    assert calculate_reward(2_500, 100).conserve_points == 250
    assert calculate_reward(500, 60).conserve_points == 30


@pytest.mark.parametrize("weight", [0, -1, 10_000_001])
def test_invalid_weight_is_rejected(weight: int) -> None:
    with pytest.raises(ValueError):
        calculate_reward(weight, 100)


def test_negative_price_is_rejected() -> None:
    with pytest.raises(ValueError):
        calculate_reward(1_000, -1)


def test_machine_weight_conversion_rejects_non_finite_values() -> None:
    assert grams_from_kg(2.5) == 2_500
    with pytest.raises(ValueError):
        grams_from_kg(float("nan"))


def test_session_transitions_follow_machine_flow() -> None:
    assert can_transition(SessionStatus.WAITING_FOR_MACHINE, SessionStatus.CONNECTED)
    assert transition(SessionStatus.PROCESSING, SessionStatus.COMPLETED) == SessionStatus.COMPLETED
    assert not can_transition(SessionStatus.COMPLETED, SessionStatus.CONNECTED)


def test_otp_is_six_digits_and_single_use() -> None:
    code = generate_otp()
    assert len(code) == 6 and code.isdecimal()
    expires_at = datetime.now(UTC) + timedelta(minutes=2)
    assert is_valid_otp(code, hash_otp(code), expires_at, None)
    assert not is_valid_otp(code, hash_otp(code), expires_at, datetime.now(UTC))


def test_expired_otp_is_invalid() -> None:
    code = generate_otp()
    expires_at = datetime.now(UTC) - timedelta(seconds=1)
    assert not is_valid_otp(code, hash_otp(code), expires_at, None)
