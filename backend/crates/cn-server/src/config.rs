use std::net::{IpAddr, Ipv6Addr, SocketAddr};

use anyhow::{anyhow, Context, Result};

use crate::services::jwt::JwtConfig;

const LOCAL_INTERNAL_API_SECRET: &str = "cn-dev-internal";
const LOCAL_DATABASE_URL: &str = "postgres://postgres:postgres@127.0.0.1:5434/conserve_naija";
const LOCAL_APP_URL: &str = "http://localhost:3000";

#[derive(Debug, Clone)]
pub struct Config {
    pub is_dev: bool,
    pub host: IpAddr,
    pub port: u16,
    pub database_url: String,
    pub app_url: String,
    pub jwt: JwtConfig,
    pub admin_emails: Vec<String>,
    pub internal_api_secret: String,
    pub test_auth: bool,
    pub device_online_after_secs: i64,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        let is_dev = !is_main();
        let host = optional("HOST")
            .unwrap_or_else(|| "0.0.0.0".to_owned())
            .parse::<IpAddr>()
            .context("parse HOST")?;
        // Railway injects PORT and proxies to it. 8080 is only the local default.
        let port = optional("PORT")
            .unwrap_or_else(|| "8080".to_owned())
            .parse::<u16>()
            .context("parse PORT")?;

        let database_url = setting("DATABASE_URL", LOCAL_DATABASE_URL)?;
        let app_url = setting("APP_URL", LOCAL_APP_URL)?
            .trim_end_matches('/')
            .to_owned();
        let jwt = JwtConfig::from_app_url(&app_url).map_err(|e| anyhow!(e.to_string()))?;
        let admin_emails = optional("ADMIN")
            .unwrap_or_default()
            .split(',')
            .map(|s| s.trim().to_lowercase())
            .filter(|s| !s.is_empty())
            .collect();

        Ok(Self {
            is_dev,
            host,
            port,
            database_url,
            app_url,
            jwt,
            admin_emails,
            internal_api_secret: setting("INTERNAL_API_SECRET", LOCAL_INTERNAL_API_SECRET)?,
            test_auth: optional("CN_TEST_AUTH").as_deref() == Some("1"),
            device_online_after_secs: 90,
        })
    }
}

/// Listen address for `HOST`/`PORT`.
///
/// Unspecified hosts (`0.0.0.0` and `::`) bind `[::]:PORT` once. On Linux
/// that socket is dual-stack, so a second bind on `0.0.0.0:$PORT` is
/// EADDRINUSE. Railway's edge reaches the container over IPv6.
pub fn listen_addr(host: IpAddr, port: u16) -> SocketAddr {
    if host.is_unspecified() {
        SocketAddr::from((Ipv6Addr::UNSPECIFIED, port))
    } else {
        SocketAddr::from((host, port))
    }
}

pub fn is_main() -> bool {
    let network = std::env::var("NETWORK")
        .unwrap_or_default()
        .trim()
        .to_lowercase();
    std::env::var("NODE_ENV").ok().as_deref() == Some("production") || network == "main"
}

pub fn optional(key: &str) -> Option<String> {
    std::env::var(key)
        .ok()
        .map(|v| v.trim().trim_matches('"').to_owned())
        .filter(|v| !v.is_empty())
}

pub fn setting(key: &str, local: &str) -> Result<String> {
    if let Some(value) = optional(key) {
        return Ok(value);
    }
    if !is_main() {
        return Ok(local.to_owned());
    }
    Err(anyhow!("{key} must be set"))
}

#[cfg(test)]
mod tests {
    use std::net::Ipv4Addr;

    use super::*;

    #[test]
    fn unspecified_host_listens_ipv6_once() {
        assert_eq!(
            listen_addr(Ipv4Addr::UNSPECIFIED.into(), 8080),
            SocketAddr::from((Ipv6Addr::UNSPECIFIED, 8080))
        );
        assert_eq!(
            listen_addr(Ipv6Addr::UNSPECIFIED.into(), 8080),
            SocketAddr::from((Ipv6Addr::UNSPECIFIED, 8080))
        );
    }

    #[test]
    fn loopback_stays_v4() {
        assert_eq!(
            listen_addr(Ipv4Addr::LOCALHOST.into(), 8080),
            SocketAddr::from((Ipv4Addr::LOCALHOST, 8080))
        );
    }

    #[tokio::test]
    async fn dual_stack_v6_owns_v4() {
        let listener = tokio::net::TcpListener::bind(listen_addr(Ipv4Addr::UNSPECIFIED.into(), 0))
            .await
            .expect("bind [::]");
        let port = listener.local_addr().expect("local addr").port();
        let v4 = tokio::net::TcpListener::bind(SocketAddr::from((Ipv4Addr::UNSPECIFIED, port)))
            .await
            .expect_err("0.0.0.0 should already be owned by dual-stack [::]");
        assert_eq!(v4.kind(), std::io::ErrorKind::AddrInUse);
    }
}
