//! Authenticated caller extracted from Better Auth JWT.

use axum::extract::FromRequestParts;
use axum::http::request::Parts;
use cn_domain::UserId;
use uuid::Uuid;

use crate::error::{AppError, AppResult};
use crate::services::jwt::bearer_token_from_header;
use crate::state::AppState;

pub struct InternalSecret;

#[derive(Debug, Clone)]
pub struct AuthUser {
    pub user_id: UserId,
    pub email: Option<String>,
    pub email_verified: bool,
}

impl AuthUser {
    pub fn require_self(&self, path_user_id: Uuid) -> AppResult<()> {
        if self.user_id.as_uuid() != path_user_id {
            return Err(AppError::Unauthorized("token subject mismatch"));
        }
        Ok(())
    }

    pub fn require_admin(&self, admin_emails: &[String]) -> AppResult<()> {
        let email = self
            .email
            .as_deref()
            .ok_or(AppError::Unauthorized("admin requires email claim"))?;
        if !self.email_verified {
            return Err(AppError::Unauthorized("email not verified"));
        }
        if !admin_emails.iter().any(|a| a == email) {
            return Err(AppError::Forbidden("not an admin"));
        }
        Ok(())
    }
}

impl FromRequestParts<AppState> for AuthUser {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let header = parts
            .headers
            .get(axum::http::header::AUTHORIZATION)
            .and_then(|v| v.to_str().ok());

        if state.config.test_auth
            && let Some(raw) = header
            && let Some(rest) = raw.strip_prefix("Test ")
        {
            let user_id = Uuid::parse_str(rest.trim())
                .map_err(|_| AppError::Unauthorized("invalid test subject"))?;
            if let Some(profile) = crate::data::users::PgUserRepo::new(state.db.clone())
                .get_by_id(UserId::from(user_id))
                .await?
            {
                return Ok(AuthUser {
                    user_id: profile.id,
                    email: Some(profile.email),
                    email_verified: profile.email_verified,
                });
            }
            return Ok(AuthUser {
                user_id: UserId::from(user_id),
                email: Some("test@conserve.local".into()),
                email_verified: true,
            });
        }

        let token = bearer_token_from_header(header)
            .ok_or(AppError::Unauthorized("missing bearer token"))?;
        let claims = state.jwt.verify(token).await?;
        Ok(AuthUser {
            user_id: UserId::from(claims.user_id),
            email: claims.email,
            email_verified: claims.email_verified,
        })
    }
}

impl FromRequestParts<AppState> for InternalSecret {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let expected = state.config.internal_api_secret.as_str();
        let provided = parts
            .headers
            .get("x-internal-secret")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");
        if provided.is_empty() || provided != expected {
            return Err(AppError::Unauthorized("invalid internal secret"));
        }
        Ok(InternalSecret)
    }
}
