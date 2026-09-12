use std::path::{Path, PathBuf};
use std::time::Duration;

use anyhow::{Context, Result};
use sqlx::PgPool;
use sqlx::postgres::PgPoolOptions;
use tracing::info;

const CONNECT_TIMEOUT: Duration = Duration::from_secs(8);
const ACQUIRE_TIMEOUT: Duration = Duration::from_secs(5);
const MIGRATE_TIMEOUT: Duration = Duration::from_secs(30);

fn migrations_dir() -> PathBuf {
    if let Ok(dir) = std::env::var("MIGRATIONS_DIR") {
        return PathBuf::from(dir);
    }
    let beside_cwd = PathBuf::from("migrations");
    if beside_cwd.is_dir() {
        return beside_cwd;
    }
    // `cargo run -p cn-server` from the backend workspace.
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../../migrations")
}

fn pool_options() -> PgPoolOptions {
    // Keep one live connection. Default min is 0, so the pool can go fully
    // idle and Postgres logs "SSL error: unexpected eof" when the proxy RST's it.
    PgPoolOptions::new()
        .max_connections(10)
        .min_connections(1)
        .acquire_timeout(ACQUIRE_TIMEOUT)
}

/// Open a pool without waiting for Postgres so the process can bind `/health` first.
pub fn open(database_url: &str) -> Result<PgPool> {
    pool_options()
        .connect_lazy(database_url)
        .context("open postgres pool")
}

/// Ping and migrate. Safe to retry; production runs this in the background.
pub async fn prepare(pool: &PgPool) -> Result<()> {
    tokio::time::timeout(CONNECT_TIMEOUT, sqlx::query("SELECT 1").execute(pool))
        .await
        .context("postgres ping timed out")?
        .context("ping postgres")?;

    let migrations_dir = migrations_dir();
    let migrator = sqlx::migrate::Migrator::new(migrations_dir.as_path())
        .await
        .with_context(|| format!("load migrations from {}", migrations_dir.display()))?;
    tokio::time::timeout(MIGRATE_TIMEOUT, migrator.run(pool))
        .await
        .context("postgres migrations timed out")?
        .context("run migrations")?;
    info!(path = %migrations_dir.display(), "postgres migrations applied");
    info!("postgres pool ready");
    Ok(())
}

/// Open a Postgres pool, run migrations, and verify connectivity. Used by tests.
pub async fn connect(database_url: &str) -> Result<PgPool> {
    let pool = open(database_url)?;
    prepare(&pool).await?;
    Ok(pool)
}
