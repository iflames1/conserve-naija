use axum::Json;
use axum::Router;
use axum::extract::{Path, State};
use axum::routing::{get, post};
use serde::Deserialize;

use crate::auth::AuthUser;
use crate::data::pickups::PgPickupRepo;
use crate::error::{AppError, AppResult};
use crate::routes::access::{parse_uuid, require_org_access};
use crate::routes::dto::{PickupResponse, pickup_dto};
use crate::services::pickups::PickupService;
use crate::state::AppState;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CompleteBody {
    collected_kg: Option<f64>,
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/pickups/{id}", get(get_pickup))
        .route("/pickups/{id}/accept", post(accept_pickup))
        .route("/pickups/{id}/complete", post(complete_pickup))
        .route("/pickups/{id}/cancel", post(cancel_pickup))
}

async fn load_authorized(
    state: &AppState,
    auth: &AuthUser,
    id: &str,
) -> AppResult<crate::data::pickups::PickupRecord> {
    let pickup = PgPickupRepo::new(state.db.clone())
        .get(parse_uuid(id, "pickup")?.into())
        .await?
        .ok_or(AppError::NotFound("pickup"))?;
    require_org_access(state, auth, pickup.organisation_id).await?;
    Ok(pickup)
}

async fn get_pickup(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
) -> AppResult<Json<PickupResponse>> {
    let pickup = load_authorized(&state, &auth, &id).await?;
    Ok(Json(pickup_dto(&pickup)))
}

async fn accept_pickup(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
) -> AppResult<Json<PickupResponse>> {
    let pickup = load_authorized(&state, &auth, &id).await?;
    let updated = PickupService::new(state.db.clone())
        .accept(pickup.id, auth.user_id)
        .await?;
    Ok(Json(pickup_dto(&updated)))
}

async fn complete_pickup(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
    Json(body): Json<CompleteBody>,
) -> AppResult<Json<PickupResponse>> {
    let pickup = load_authorized(&state, &auth, &id).await?;
    let collected = match body.collected_kg {
        Some(kg) => Some(
            cn_domain::grams_from_kg(kg).map_err(|err| AppError::BadRequest(err.to_string()))?,
        ),
        None => None,
    };
    let updated = PickupService::new(state.db.clone())
        .complete(pickup.id, collected)
        .await?;
    Ok(Json(pickup_dto(&updated)))
}

async fn cancel_pickup(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
) -> AppResult<Json<PickupResponse>> {
    let pickup = load_authorized(&state, &auth, &id).await?;
    let updated = PickupService::new(state.db.clone()).cancel(pickup.id).await?;
    Ok(Json(pickup_dto(&updated)))
}
