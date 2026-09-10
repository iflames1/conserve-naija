use std::net::IpAddr;
use std::time::Duration;

use anyhow::Context;
use tracing::info;

use cn_server::config::{self, Config};
use cn_server::infra::postgres;
use cn_server::routes;
use cn_server::state::AppState;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();
    init_tracing();

    let config = Config::from_env().context("load config")?;
    info!(
        host = %config.host,
        port = config.port,
        port_from_env = ?std::env::var("PORT").ok(),
        dev = config.is_dev,
        "starting conserve naija"
    );

    let db = postgres::open(&config.database_url).context("postgres")?;
    let state = AppState::new(config.clone(), db);

    {
        let jwt = state.jwt.clone();
        tokio::spawn(async move {
            if let Err(err) = jwt.prefetch().await {
                tracing::warn!(error = %err, "JWKS not cached yet; first login may fetch it");
            }
        });
    }
    {
        let pool = state.db.clone();
        tokio::spawn(async move {
            let mut delay = Duration::from_secs(1);
            loop {
                match postgres::prepare(&pool).await {
                    Ok(()) => break,
                    Err(err) => {
                        tracing::error!(error = %err, "postgres prepare failed; retrying");
                        tokio::time::sleep(delay).await;
                        delay = (delay * 2).min(Duration::from_secs(15));
                    }
                }
            }
        });
    }

    let app = routes::router(state);
    serve_http(config.host, config.port, app).await
}

/// Bind IPv4+IPv6 when HOST is unspecified so Railway's IPv6 edge can connect.
async fn serve_http(host: IpAddr, port: u16, app: axum::Router) -> anyhow::Result<()> {
    let mut listeners = Vec::new();
    let mut last_err = None;
    for addr in config::listen_addrs(host, port) {
        match tokio::net::TcpListener::bind(addr).await {
            Ok(listener) => {
                let bound = listener.local_addr().unwrap_or(addr);
                info!(%bound, "listening");
                listeners.push(listener);
            }
            Err(err) => {
                tracing::warn!(%addr, error = %err, "bind failed");
                last_err = Some((addr, err));
            }
        }
    }

    match listeners.len() {
        0 => {
            let (addr, err) = last_err.expect("listen_addrs is never empty");
            Err(err).with_context(|| format!("bind {addr}"))
        }
        1 => axum::serve(listeners.remove(0), app)
            .await
            .context("serve http"),
        _ => {
            let v6 = listeners.remove(0);
            let v4 = listeners.remove(0);
            let app_v4 = app.clone();
            tokio::select! {
                result = axum::serve(v6, app) => result.context("serve http"),
                result = axum::serve(v4, app_v4) => result.context("serve http"),
            }
        }
    }
}

fn init_tracing() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,cn_server=debug".into()),
        )
        .with_target(true)
        .compact()
        .init();
}
