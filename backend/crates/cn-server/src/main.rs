use std::net::SocketAddr;

use anyhow::Context;
use tracing::info;

use cn_server::config::Config;
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
        dev = config.is_dev,
        "starting conserve naija"
    );

    let db = postgres::connect(&config.database_url)
        .await
        .context("postgres")?;
    let state = AppState::new(config.clone(), db);
    let app = routes::router(state);

    let addr = SocketAddr::from((config.host, config.port));
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .with_context(|| format!("bind {addr}"))?;
    info!(%addr, "listening");
    axum::serve(listener, app).await.context("serve http")?;
    Ok(())
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
