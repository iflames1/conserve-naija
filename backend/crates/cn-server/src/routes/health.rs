use axum::Json;
use axum::Router;
use axum::extract::State;
use axum::routing::get;
use serde::Serialize;

use crate::error::AppResult;
use crate::state::AppState;

#[derive(Serialize)]
pub(crate) struct Health {
    ok: bool,
    service: &'static str,
}

pub fn router() -> Router<AppState> {
    Router::new().route("/health", get(health))
}

async fn health(State(state): State<AppState>) -> AppResult<Json<Health>> {
    sqlx::query("SELECT 1")
        .execute(&state.db)
        .await
        .map_err(|err| crate::error::AppError::Internal(err.into()))?;
    Ok(Json(Health {
        ok: true,
        service: "conserve-naija",
    }))
}

pub async fn root() -> Json<Health> {
    Json(Health {
        ok: true,
        service: "conserve-naija",
    })
}
