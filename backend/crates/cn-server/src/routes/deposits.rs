use axum::Json;
use axum::Router;
use axum::extract::{Path, State};
use axum::routing::get;

use crate::auth::AuthUser;
use crate::data::deposits::PgDepositRepo;
use crate::error::{AppError, AppResult};
use crate::routes::access::parse_uuid;
use crate::routes::dto::{DepositResponse, deposit_dto};
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new().route("/deposits/{id}", get(get_deposit))
}

async fn get_deposit(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
) -> AppResult<Json<DepositResponse>> {
    let deposit = PgDepositRepo::new(state.db.clone())
        .get(parse_uuid(&id, "deposit")?.into())
        .await?
        .ok_or(AppError::NotFound("deposit"))?;
    if deposit.user_id != auth.user_id {
        return Err(AppError::Forbidden("not your deposit"));
    }
    Ok(Json(deposit_dto(&deposit, None)))
}
