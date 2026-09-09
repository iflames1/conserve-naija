mod access;
mod admin;
mod collection_points;
mod deposits;
mod dto;
mod health;
mod iot;
mod organisation;
mod pickups;
mod sessions;
mod users;
mod ws;

use axum::Router;
use axum::routing::get;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;

use crate::state::AppState;

pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/", get(health::root))
        .merge(health::router())
        .merge(users::router())
        .merge(collection_points::router())
        .merge(sessions::router())
        .merge(deposits::router())
        .merge(organisation::router())
        .merge(pickups::router())
        .merge(iot::router())
        .merge(admin::router())
        .merge(ws::router())
        .layer(TraceLayer::new_for_http())
        .layer(CorsLayer::permissive())
        .with_state(state)
}
