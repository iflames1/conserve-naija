use axum::Json;
use axum::Router;
use axum::extract::{Path, State};
use axum::routing::{get, post};
use cn_domain::grams_from_kg;
use serde::Deserialize;
use serde_json::Value;

use crate::data::devices::PgDeviceRepo;
use crate::data::materials::PgMaterialRepo;
use crate::device_auth::AuthDevice;
use crate::error::{AppError, AppResult};
use crate::routes::access::parse_uuid;
use crate::routes::dto::device_dto;
use crate::services::sessions::{SessionService, machine_session_view};
use crate::state::AppState;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct HeartbeatBody {
    latitude: Option<f64>,
    longitude: Option<f64>,
    firmware_version: Option<String>,
}

#[derive(Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct TelemetryBin {
    material: String,
    #[serde(alias = "weightKg", alias = "weight_kg")]
    weight_kg: f64,
    #[serde(alias = "fillPercent", alias = "fill_percent")]
    fill_percent: Option<i32>,
}

#[derive(Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct TelemetryBody {
    timestamp: Option<String>,
    location: Option<TelemetryLocation>,
    bins: Vec<TelemetryBin>,
}

#[derive(Deserialize, serde::Serialize)]
struct TelemetryLocation {
    latitude: Option<f64>,
    longitude: Option<f64>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ClaimBody {
    code: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SessionMeasurementBody {
    material: Option<String>,
    #[serde(alias = "weightKg", alias = "weight_kg")]
    weight_kg: f64,
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/iot/devices/me", get(me))
        .route("/iot/devices/me/heartbeat", post(heartbeat))
        .route("/iot/devices/me/telemetry", post(telemetry))
        .route("/iot/devices/me/sessions/claim", post(claim_session))
        .route(
            "/iot/devices/me/sessions/{id}/measurement",
            post(session_measurement),
        )
}

async fn me(
    State(state): State<AppState>,
    device: AuthDevice,
) -> AppResult<Json<crate::routes::dto::DeviceResponse>> {
    let bins = PgDeviceRepo::new(state.db.clone())
        .latest_bins(device.id())
        .await?;
    Ok(Json(device_dto(&device.device, bins, chrono::Utc::now())))
}

async fn heartbeat(
    State(state): State<AppState>,
    device: AuthDevice,
    Json(body): Json<HeartbeatBody>,
) -> AppResult<Json<Value>> {
    PgDeviceRepo::new(state.db.clone())
        .touch_heartbeat(
            device.id(),
            body.latitude,
            body.longitude,
            body.firmware_version.as_deref(),
        )
        .await?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

async fn telemetry(
    State(state): State<AppState>,
    device: AuthDevice,
    Json(body): Json<TelemetryBody>,
) -> AppResult<Json<Value>> {
    let repo = PgDeviceRepo::new(state.db.clone());
    let lat = body.location.as_ref().and_then(|l| l.latitude);
    let lng = body.location.as_ref().and_then(|l| l.longitude);
    repo.touch_heartbeat(device.id(), lat, lng, None).await?;

    let payload = serde_json::to_value(&body).unwrap_or_else(|_| serde_json::json!({}));
    let telemetry_id = repo
        .insert_telemetry(device.id(), lat, lng, &payload)
        .await?;

    let materials = PgMaterialRepo::new(state.db.clone());
    for bin in &body.bins {
        let material = materials
            .get_by_slug(&bin.material)
            .await?
            .ok_or_else(|| AppError::BadRequest(format!("unknown material '{}'", bin.material)))?;
        let grams = grams_from_kg(bin.weight_kg).map_err(|err| AppError::BadRequest(err.to_string()))?;
        if let Some(fill) = bin.fill_percent
            && !(0..=100).contains(&fill)
        {
            return Err(AppError::BadRequest("fill percent must be 0–100".into()));
        }
        repo.upsert_bin_state(device.id(), material.id, grams, bin.fill_percent)
            .await?;
    }

    Ok(Json(serde_json::json!({
        "ok": true,
        "telemetryId": telemetry_id,
        "recordedAt": body.timestamp,
    })))
}

async fn claim_session(
    State(state): State<AppState>,
    device: AuthDevice,
    Json(body): Json<ClaimBody>,
) -> AppResult<Json<Value>> {
    PgDeviceRepo::new(state.db.clone())
        .touch_heartbeat(device.id(), None, None, None)
        .await?;
    let session = SessionService::new(state.db.clone(), state.realtime.clone())
        .claim(&device.device, &body.code)
        .await?;
    Ok(Json(machine_session_view(&session)))
}

async fn session_measurement(
    State(state): State<AppState>,
    device: AuthDevice,
    Path(id): Path<String>,
    Json(body): Json<SessionMeasurementBody>,
) -> AppResult<Json<Value>> {
    PgDeviceRepo::new(state.db.clone())
        .touch_heartbeat(device.id(), None, None, None)
        .await?;
    let material = body
        .material
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or("plastic");
    let session = SessionService::new(state.db.clone(), state.realtime.clone())
        .measure(
            &device.device,
            parse_uuid(&id, "session")?.into(),
            material,
            body.weight_kg,
        )
        .await?;
    Ok(Json(machine_session_view(&session)))
}
