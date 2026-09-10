//! Domain types and rules for Conserve Naija.
//!
//! Shapes and calculations live here. Persistence and HTTP stay in `cn-server`.

pub mod ids;
pub mod reward;

pub use ids::*;
pub use reward::*;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum UserRole {
    Citizen,
    OrganisationMember,
    Collector,
    Admin,
}

impl UserRole {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Citizen => "citizen",
            Self::OrganisationMember => "organisation_member",
            Self::Collector => "collector",
            Self::Admin => "admin",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "citizen" => Some(Self::Citizen),
            "organisation_member" => Some(Self::OrganisationMember),
            "collector" => Some(Self::Collector),
            "admin" => Some(Self::Admin),
            _ => None,
        }
    }
}

/// Physical location. Stored as `collection_points`; product name is Conserve Site.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CollectionPointStatus {
    Active,
    Inactive,
    Maintenance,
}

impl CollectionPointStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Active => "active",
            Self::Inactive => "inactive",
            Self::Maintenance => "maintenance",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "active" => Some(Self::Active),
            "inactive" => Some(Self::Inactive),
            "maintenance" => Some(Self::Maintenance),
            _ => None,
        }
    }

    pub fn accepts_deposits(self) -> bool {
        matches!(self, Self::Active)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RecyclingSessionStatus {
    WaitingForMachine,
    Connected,
    Sorting,
    Measuring,
    Processing,
    Completed,
    Expired,
    Cancelled,
    Failed,
}

impl RecyclingSessionStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::WaitingForMachine => "waiting_for_machine",
            Self::Connected => "connected",
            Self::Sorting => "sorting",
            Self::Measuring => "measuring",
            Self::Processing => "processing",
            Self::Completed => "completed",
            Self::Expired => "expired",
            Self::Cancelled => "cancelled",
            Self::Failed => "failed",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "waiting_for_machine" => Some(Self::WaitingForMachine),
            "connected" => Some(Self::Connected),
            "sorting" => Some(Self::Sorting),
            "measuring" => Some(Self::Measuring),
            "processing" => Some(Self::Processing),
            "completed" => Some(Self::Completed),
            "expired" => Some(Self::Expired),
            "cancelled" => Some(Self::Cancelled),
            "failed" => Some(Self::Failed),
            _ => None,
        }
    }

    pub fn is_open(self) -> bool {
        matches!(
            self,
            Self::WaitingForMachine
                | Self::Connected
                | Self::Sorting
                | Self::Measuring
                | Self::Processing
        )
    }

    pub fn is_claimable(self) -> bool {
        matches!(self, Self::WaitingForMachine)
    }

    pub fn can_measure(self) -> bool {
        matches!(
            self,
            Self::Connected | Self::Sorting | Self::Measuring | Self::Processing
        )
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DepositStatus {
    PendingMeasurement,
    Measured,
    Confirmed,
    Cancelled,
}

impl DepositStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::PendingMeasurement => "pending_measurement",
            Self::Measured => "measured",
            Self::Confirmed => "confirmed",
            Self::Cancelled => "cancelled",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "pending_measurement" => Some(Self::PendingMeasurement),
            "measured" => Some(Self::Measured),
            "confirmed" => Some(Self::Confirmed),
            "cancelled" => Some(Self::Cancelled),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PickupStatus {
    Ready,
    Accepted,
    Completed,
    Cancelled,
}

impl PickupStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Ready => "ready",
            Self::Accepted => "accepted",
            Self::Completed => "completed",
            Self::Cancelled => "cancelled",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "ready" => Some(Self::Ready),
            "accepted" => Some(Self::Accepted),
            "completed" => Some(Self::Completed),
            "cancelled" => Some(Self::Cancelled),
            _ => None,
        }
    }

    pub fn is_open(self) -> bool {
        matches!(self, Self::Ready | Self::Accepted)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LedgerType {
    DepositReward,
    Redemption,
    Adjustment,
}

impl LedgerType {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::DepositReward => "deposit_reward",
            Self::Redemption => "redemption",
            Self::Adjustment => "adjustment",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "deposit_reward" => Some(Self::DepositReward),
            "redemption" => Some(Self::Redemption),
            "adjustment" => Some(Self::Adjustment),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DeviceHealth {
    Online,
    Offline,
}

impl DeviceHealth {
    pub fn from_last_seen(last_seen: Option<DateTime<Utc>>, now: DateTime<Utc>) -> Self {
        match last_seen {
            Some(seen) if (now - seen).num_seconds() <= ONLINE_AFTER_SECS => Self::Online,
            _ => Self::Offline,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct User {
    pub id: UserId,
    pub email: String,
    pub display_name: String,
    pub avatar_url: Option<String>,
    pub email_verified: bool,
    pub green_points_balance: i64,
    pub roles: Vec<UserRole>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Material {
    pub id: MaterialId,
    pub name: String,
    pub slug: String,
    pub unit: String,
    pub active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Organisation {
    pub id: OrganisationId,
    pub name: String,
    pub slug: String,
}

/// Display name for a Conserve Site. DB may still store "Yaba Collection Point".
pub fn conserve_site_label(name: &str) -> String {
    let trimmed = name.trim();
    let without_prefix = trimmed
        .strip_prefix("Conserve Site — ")
        .or_else(|| trimmed.strip_prefix("Conserve Site - "))
        .unwrap_or(trimmed);
    let short = without_prefix
        .strip_suffix(" Collection Point")
        .unwrap_or(without_prefix)
        .trim();
    if short.is_empty() {
        "Conserve Site".into()
    } else {
        format!("Conserve Site — {short}")
    }
}
