use axum::extract::FromRequestParts;
use axum::http::request::Parts;
use cn_domain::{DeviceId, OrganisationId};
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::data::devices::{DeviceRecord, PgDeviceRepo};
use crate::error::AppError;
use crate::state::AppState;

#[derive(Debug, Clone)]
pub struct AuthDevice {
    pub device: DeviceRecord,
}

pub fn hash_api_key(raw: &str) -> String {
    let digest = Sha256::digest(raw.as_bytes());
    hex::encode(digest)
}

pub fn generate_api_key() -> String {
    format!("cn_dev_{}", Uuid::now_v7().simple())
}

impl FromRequestParts<AppState> for AuthDevice {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let header = parts
            .headers
            .get(axum::http::header::AUTHORIZATION)
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");
        let key = header
            .strip_prefix("Device ")
            .or_else(|| {
                parts
                    .headers
                    .get("x-device-key")
                    .and_then(|v| v.to_str().ok())
            })
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .ok_or(AppError::Unauthorized("missing device credentials"))?;

        let repo = PgDeviceRepo::new(state.db.clone());
        let device = repo
            .get_by_api_key_hash(&hash_api_key(key))
            .await?
            .ok_or(AppError::Unauthorized("unknown device"))?;
        if device.status != "active" {
            return Err(AppError::Unauthorized("device disabled"));
        }
        Ok(AuthDevice { device })
    }
}

impl AuthDevice {
    pub fn id(&self) -> DeviceId {
        self.device.id
    }

    pub fn organisation_id(&self) -> OrganisationId {
        self.device.organisation_id
    }
}
