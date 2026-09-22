"""Authoritative Conserve Points calculation."""

from dataclasses import dataclass

GRAMS_PER_KILOGRAM = 1_000
MIN_DEPOSIT_GRAMS = 1
MAX_DEPOSIT_GRAMS = 10_000_000


class RewardError(ValueError):
    """Raised when a measured fraction cannot be rewarded."""


@dataclass(frozen=True, slots=True)
class Reward:
    weight_grams: int
    price_per_kg_naira: int
    conserve_points: int


def calculate_reward(weight_grams: int, price_per_kg_naira: int) -> Reward:
    """Calculate CP from backend-validated machine measurements and price snapshots."""
    if weight_grams < MIN_DEPOSIT_GRAMS:
        raise RewardError("weight must be greater than zero")
    if weight_grams > MAX_DEPOSIT_GRAMS:
        raise RewardError("weight exceeds the allowed deposit limit")
    if price_per_kg_naira < 0:
        raise RewardError("material price cannot be negative")

    return Reward(
        weight_grams=weight_grams,
        price_per_kg_naira=price_per_kg_naira,
        conserve_points=weight_grams * price_per_kg_naira // GRAMS_PER_KILOGRAM,
    )


def grams_from_kg(weight_kg: float) -> int:
    """Convert a finite machine reading to integer grams."""
    if not isinstance(weight_kg, int | float) or not weight_kg > 0:
        raise RewardError("weight must be greater than zero")
    if weight_kg != weight_kg or weight_kg in (float("inf"), float("-inf")):
        raise RewardError("weight must be finite")

    grams = round(weight_kg * GRAMS_PER_KILOGRAM)
    if grams < MIN_DEPOSIT_GRAMS:
        raise RewardError("weight must be greater than zero")
    if grams > MAX_DEPOSIT_GRAMS:
        raise RewardError("weight exceeds the allowed deposit limit")
    return grams
