use std::time::Duration;

use axum::Json;
use axum::Router;
use axum::extract::State;
use axum::http::StatusCode;
use axum::routing::get;
use serde::Serialize;

use crate::state::AppState;

#[derive(Serialize)]
pub(crate) struct Health {
    ok: bool,
    service: &'static str,
}

#[derive(Serialize)]
pub(crate) struct Ready {
    ok: bool,
    service: &'static str,
    postgres: &'static str,
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/health", get(health))
        .route("/ready", get(ready))
}

/// Liveness only. Railway and the frontend warmup must not wait on Postgres or JWKS.
async fn health() -> Json<Health> {
    Json(Health {
        ok: true,
        service: "conserve-naija",
    })
}

async fn ready(State(state): State<AppState>) -> (StatusCode, Json<Ready>) {
    let postgres_ok = tokio::time::timeout(
        Duration::from_secs(2),
        sqlx::query_scalar::<_, i32>("SELECT 1").fetch_one(&state.db),
    )
    .await
    .ok()
    .and_then(Result::ok)
    .is_some_and(|n| n == 1);

    let status = if postgres_ok {
        StatusCode::OK
    } else {
        StatusCode::SERVICE_UNAVAILABLE
    };

    (
        status,
        Json(Ready {
            ok: postgres_ok,
            service: "conserve-naija",
            postgres: if postgres_ok { "up" } else { "down" },
        }),
    )
}

pub async fn root() -> Json<Health> {
    Json(Health {
        ok: true,
        service: "conserve-naija",
    })
}
