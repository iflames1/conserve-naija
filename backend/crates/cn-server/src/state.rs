use std::sync::Arc;

use sqlx::PgPool;

use crate::config::Config;
use crate::services::jwt::JwtVerifier;
use crate::services::realtime::RealtimeHub;

#[derive(Clone)]
pub struct AppState {
    pub config: Arc<Config>,
    pub db: PgPool,
    pub jwt: Arc<JwtVerifier>,
    pub realtime: RealtimeHub,
}

impl AppState {
    pub fn new(config: Config, db: PgPool) -> Self {
        let jwt = JwtVerifier::arc(config.jwt.clone());
        Self {
            config: Arc::new(config),
            db,
            jwt,
            realtime: RealtimeHub::new(),
        }
    }
}
