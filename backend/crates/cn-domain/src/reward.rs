//! Green Point reward math. 1 Green Point = ₦1.
//!
//! Weight is stored in grams. Price is ₦ per kilogram at the time of confirmation.
//! `2_500g * ₦100/kg / 1000 = 250` Green Points.

use thiserror::Error;

pub const GRAMS_PER_KG: i64 = 1_000;
pub const MIN_DEPOSIT_GRAMS: i64 = 1;
pub const MAX_DEPOSIT_GRAMS: i64 = 10_000_000;
pub const ONLINE_AFTER_SECS: i64 = 90;

#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum RewardError {
    #[error("weight must be greater than zero")]
    InvalidWeight,
    #[error("weight exceeds the allowed deposit limit")]
    WeightTooLarge,
    #[error("material price cannot be negative")]
    InvalidPrice,
}

/// Authoritative reward for a confirmed deposit.
pub fn green_points_for_deposit(
    weight_grams: i64,
    price_per_kg_naira: i64,
) -> Result<i64, RewardError> {
    if weight_grams < MIN_DEPOSIT_GRAMS {
        return Err(RewardError::InvalidWeight);
    }
    if weight_grams > MAX_DEPOSIT_GRAMS {
        return Err(RewardError::WeightTooLarge);
    }
    if price_per_kg_naira < 0 {
        return Err(RewardError::InvalidPrice);
    }
    Ok(weight_grams.saturating_mul(price_per_kg_naira) / GRAMS_PER_KG)
}

pub fn grams_from_kg(weight_kg: f64) -> Result<i64, RewardError> {
    if !weight_kg.is_finite() || weight_kg <= 0.0 {
        return Err(RewardError::InvalidWeight);
    }
    let grams = (weight_kg * GRAMS_PER_KG as f64).round() as i64;
    if grams < MIN_DEPOSIT_GRAMS {
        return Err(RewardError::InvalidWeight);
    }
    if grams > MAX_DEPOSIT_GRAMS {
        return Err(RewardError::WeightTooLarge);
    }
    Ok(grams)
}

pub fn kg_from_grams(weight_grams: i64) -> f64 {
    weight_grams as f64 / GRAMS_PER_KG as f64
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn plastic_example_from_brief() {
        assert_eq!(green_points_for_deposit(2_500, 100).unwrap(), 250);
    }

    #[test]
    fn rejects_zero_and_negative_weight() {
        assert_eq!(
            green_points_for_deposit(0, 100),
            Err(RewardError::InvalidWeight)
        );
        assert_eq!(
            green_points_for_deposit(-1, 100),
            Err(RewardError::InvalidWeight)
        );
    }

    #[test]
    fn rejects_negative_price() {
        assert_eq!(
            green_points_for_deposit(1_000, -1),
            Err(RewardError::InvalidPrice)
        );
    }

    #[test]
    fn zero_price_is_a_valid_snapshot() {
        assert_eq!(green_points_for_deposit(2_500, 0).unwrap(), 0);
    }

    #[test]
    fn kg_round_trip() {
        assert_eq!(grams_from_kg(2.5).unwrap(), 2_500);
        assert!((kg_from_grams(2_500) - 2.5).abs() < f64::EPSILON);
    }
}
