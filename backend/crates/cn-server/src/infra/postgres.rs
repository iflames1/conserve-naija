use std::path::{Path, PathBuf};

use std::time::Duration;

use anyhow::{Context, Result};
use sqlx::PgPool;
use sqlx::postgres::PgPoolOptions;
use tracing::info;

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

/// Open a Postgres pool, run migrations, and verify connectivity. Required for boot.
pub async fn connect(database_url: &str) -> Result<PgPool> {
    let pool = tokio::time::timeout(
        Duration::from_secs(10),
        PgPoolOptions::new()
            .max_connections(10)
            .acquire_timeout(Duration::from_secs(15))
            .connect(database_url),
    )
    .await
    .context("postgres connect timed out")?
    .context("connect to postgres")?;

    sqlx::query("SELECT 1")
        .execute(&pool)
        .await
        .context("ping postgres")?;

    let migrations_dir = migrations_dir();
    let migrator = sqlx::migrate::Migrator::new(migrations_dir.as_path())
        .await
        .with_context(|| format!("load migrations from {}", migrations_dir.display()))?;
    migrator.run(&pool).await.context("run migrations")?;
    info!(path = %migrations_dir.display(), "postgres migrations applied");

    info!("postgres pool ready");
    Ok(pool)
}
