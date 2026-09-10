use std::net::SocketAddr;
use std::time::Duration;

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
