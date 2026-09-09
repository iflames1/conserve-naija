//! Better Auth JWT verification (EdDSA + JWKS).

use std::sync::Arc;
use std::time::Duration;

use jsonwebtoken::{Algorithm, DecodingKey, Validation, decode, decode_header};
use parking_lot::RwLock;
use serde::Deserialize;
use serde_json::Value;
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::error::{AppError, AppResult};

#[derive(Debug, Clone)]
pub struct JwtConfig {
    pub jwks_url: String,
    pub issuer: String,
    pub audience: String,
}

impl JwtConfig {
    pub fn from_app_url(base_url: &str) -> AppResult<Self> {
        let base = base_url.trim().trim_end_matches('/');
        if base.is_empty() {
            return Err(AppError::Internal(anyhow::anyhow!("APP_URL is empty")));
        }
        if !base.starts_with("https://") && !base.starts_with("http://") {
            return Err(AppError::Internal(anyhow::anyhow!(
                "APP_URL must start with http(s)://"
            )));
        }
        Ok(Self {
            jwks_url: format!("{base}/api/auth/jwks"),
            issuer: base.to_owned(),
            audience: base.to_owned(),
        })
    }
}

#[derive(Debug, Clone)]
pub struct JwtClaims {
    pub user_id: Uuid,
    pub email: Option<String>,
    pub email_verified: bool,
}

#[derive(Debug, Deserialize)]
struct RawClaims {
    sub: String,
    email: Option<String>,
    #[serde(default, rename = "emailVerified")]
    email_verified: Option<bool>,
    #[serde(flatten)]
    _rest: Value,
}

struct JwksCache {
    keys: Vec<(String, DecodingKey)>,
}

pub struct JwtVerifier {
    config: JwtConfig,
    http: reqwest::Client,
    cache: RwLock<Option<JwksCache>>,
    refresh: Mutex<()>,
}

impl JwtVerifier {
    pub fn new(config: JwtConfig) -> Self {
        Self {
            config,
            http: reqwest::Client::builder()
                .timeout(Duration::from_secs(5))
                .connect_timeout(Duration::from_secs(3))
                .build()
                .expect("jwt http client"),
            cache: RwLock::new(None),
            refresh: Mutex::new(()),
        }
    }

    pub fn arc(config: JwtConfig) -> Arc<Self> {
        Arc::new(Self::new(config))
    }

    /// Pull JWKS before serving traffic so auth does not wait on the Next.js app
    /// from inside a request that originated there (server-action deadlock).
    pub async fn prefetch(&self) -> AppResult<()> {
        self.refresh_jwks().await
    }

    pub async fn verify(&self, token: &str) -> AppResult<JwtClaims> {
        let token = token.trim();
        if token.is_empty() {
            return Err(AppError::Unauthorized("missing bearer token"));
        }

        let header =
            decode_header(token).map_err(|_| AppError::Unauthorized("invalid token header"))?;
        if header.alg != Algorithm::EdDSA {
            return Err(AppError::Unauthorized("unsupported token algorithm"));
        }
        let kid = header
            .kid
            .clone()
            .ok_or(AppError::Unauthorized("token missing kid"))?;

        let key = self.decoding_key_for_kid(&kid).await?;
        let mut validation = Validation::new(Algorithm::EdDSA);
        validation.set_issuer(&[self.config.issuer.clone()]);
        validation.set_audience(&[self.config.audience.clone()]);
        validation.validate_exp = true;
        validation.leeway = 30;

        let data = decode::<RawClaims>(token, &key, &validation)
            .map_err(|_| AppError::Unauthorized("invalid or expired token"))?;

        let user_id = parse_jwt_sub(&data.claims.sub)?;
        let email = data
            .claims
            .email
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(|s| s.to_lowercase());
        let email_verified = data.claims.email_verified.unwrap_or(false);

        Ok(JwtClaims {
            user_id,
            email,
            email_verified,
        })
    }

    async fn decoding_key_for_kid(&self, kid: &str) -> AppResult<DecodingKey> {
        if let Some(key) = self.cached_key(kid) {
            return Ok(key);
        }
        {
            let _guard = self.refresh.lock().await;
            if let Some(key) = self.cached_key(kid) {
                return Ok(key);
            }
            self.refresh_jwks_locked().await?;
        }
        self.cached_key(kid)
            .ok_or(AppError::Unauthorized("unknown token kid"))
    }

    fn cached_key(&self, kid: &str) -> Option<DecodingKey> {
        let guard = self.cache.read();
        guard.as_ref()?.keys.iter().find(|(k, _)| k == kid).map(|(_, key)| key.clone())
    }

    async fn refresh_jwks(&self) -> AppResult<()> {
        let _guard = self.refresh.lock().await;
        self.refresh_jwks_locked().await
    }

    async fn refresh_jwks_locked(&self) -> AppResult<()> {
        tracing::debug!(url = %self.config.jwks_url, "refreshing JWKS");
        let res = match self.http.get(&self.config.jwks_url).send().await {
            Ok(res) => res,
            Err(err) => {
                if self.cache.read().is_some() {
                    tracing::warn!(error = %err, "JWKS refresh failed; keeping stale keys");
                    return Ok(());
                }
                return Err(AppError::Internal(err.into()));
            }
        };
        if !res.status().is_success() {
            if self.cache.read().is_some() {
                tracing::warn!(status = %res.status(), "JWKS refresh failed; keeping stale keys");
                return Ok(());
            }
            return Err(AppError::Internal(anyhow::anyhow!(
                "JWKS fetch failed: {}",
                res.status()
            )));
        }
        let body: Value = res.json().await.map_err(|e| AppError::Internal(e.into()))?;
        let keys_json = body
            .get("keys")
            .and_then(|v| v.as_array())
            .ok_or_else(|| AppError::Internal(anyhow::anyhow!("JWKS missing keys")))?;

        let mut keys = Vec::new();
        for key_val in keys_json {
            let kid = key_val
                .get("kid")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_owned();
            if kid.is_empty() {
                continue;
            }
            let kty = key_val.get("kty").and_then(|v| v.as_str()).unwrap_or("");
            let crv = key_val.get("crv").and_then(|v| v.as_str()).unwrap_or("");
            let x = key_val.get("x").and_then(|v| v.as_str()).unwrap_or("");
            if kty != "OKP" || crv != "Ed25519" || x.is_empty() {
                continue;
            }
            match DecodingKey::from_ed_components(x) {
                Ok(decoding) => keys.push((kid, decoding)),
                Err(err) => tracing::warn!(%kid, error = %err, "skip JWKS key"),
            }
        }
        if keys.is_empty() {
            if self.cache.read().is_some() {
                tracing::warn!("JWKS contained no usable Ed25519 keys; keeping stale keys");
                return Ok(());
            }
            return Err(AppError::Internal(anyhow::anyhow!(
                "JWKS contained no usable Ed25519 keys"
            )));
        }
        *self.cache.write() = Some(JwksCache { keys });
        Ok(())
    }
}

pub fn parse_jwt_sub(sub: &str) -> AppResult<Uuid> {
    let id = Uuid::parse_str(sub.trim())
        .map_err(|_| AppError::Unauthorized("token sub is not a uuid"))?;
    if id.is_nil() {
        return Err(AppError::Unauthorized("token sub is not a uuid"));
    }
    Ok(id)
}

pub fn bearer_token_from_header(value: Option<&str>) -> Option<&str> {
    let value = value?.trim();
    let rest = value
        .strip_prefix("Bearer ")
        .or_else(|| value.strip_prefix("bearer "))?;
    let token = rest.trim();
    if token.is_empty() { None } else { Some(token) }
}
