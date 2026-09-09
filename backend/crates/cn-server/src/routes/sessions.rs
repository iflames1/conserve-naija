use axum::Json;
use axum::Router;
use axum::extract::{Path, State};
use axum::routing::{get, post};
use serde_json::Value;

use crate::auth::AuthUser;
use crate::error::AppResult;
use crate::routes::access::parse_uuid;
use crate::services::sessions::{SessionService, session_json};
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/recycling-sessions", post(start_session))
        .route("/recycling-sessions/active", get(active_session))
        .route("/recycling-sessions/{id}", get(get_session))
        .route("/recycling-sessions/{id}/cancel", post(cancel_session))
}

async fn start_session(State(state): State<AppState>, auth: AuthUser) -> AppResult<Json<Value>> {
    let session = SessionService::new(state.db.clone(), state.realtime.clone())
        .start(auth.user_id)
        .await?;
    Ok(Json(session_json(&session)))
}

async fn active_session(State(state): State<AppState>, auth: AuthUser) -> AppResult<Json<Value>> {
    let session = SessionService::new(state.db.clone(), state.realtime.clone())
        .active_for_user(auth.user_id)
        .await?;
    Ok(Json(match session {
        Some(session) => session_json(&session),
        None => serde_json::json!(null),
    }))
}

async fn get_session(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
) -> AppResult<Json<Value>> {
    let session = SessionService::new(state.db.clone(), state.realtime.clone())
        .get_for_user(auth.user_id, parse_uuid(&id, "session")?.into())
        .await?;
    Ok(Json(session_json(&session)))
}

async fn cancel_session(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
) -> AppResult<Json<Value>> {
    let session = SessionService::new(state.db.clone(), state.realtime.clone())
        .cancel(auth.user_id, parse_uuid(&id, "session")?.into())
        .await?;
    Ok(Json(session_json(&session)))
}
