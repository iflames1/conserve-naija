use cn_domain::{OrganisationId, UserRole};
use uuid::Uuid;

use crate::auth::AuthUser;
use crate::data::organisations::{Membership, PgOrganisationRepo};
use crate::data::users::PgUserRepo;
use crate::error::{AppError, AppResult};
use crate::state::AppState;

pub async fn load_memberships(state: &AppState, user: &AuthUser) -> AppResult<Vec<Membership>> {
    PgOrganisationRepo::new(state.db.clone())
        .memberships_for_user(user.user_id)
        .await
}

pub async fn is_platform_admin(state: &AppState, user: &AuthUser) -> AppResult<bool> {
    if user
        .email
        .as_ref()
        .is_some_and(|email| state.config.admin_emails.iter().any(|a| a == email))
    {
        return Ok(true);
    }
    let profile = PgUserRepo::new(state.db.clone())
        .get_by_id(user.user_id)
        .await?;
    Ok(profile
        .map(|u| u.roles.contains(&UserRole::Admin))
        .unwrap_or(false))
}

pub async fn require_platform_admin(state: &AppState, user: &AuthUser) -> AppResult<()> {
    if is_platform_admin(state, user).await? {
        return Ok(());
    }
    Err(AppError::Forbidden("admin only"))
}

pub async fn require_org_access(
    state: &AppState,
    user: &AuthUser,
    organisation_id: OrganisationId,
) -> AppResult<Membership> {
    if is_platform_admin(state, user).await? {
        let org = PgOrganisationRepo::new(state.db.clone())
            .get(organisation_id)
            .await?
            .ok_or(AppError::NotFound("organisation"))?;
        return Ok(Membership {
            organisation_id: org.id,
            user_id: user.user_id,
            member_role: "admin".into(),
            name: org.name,
            slug: org.slug,
        });
    }
    let memberships = load_memberships(state, user).await?;
    memberships
        .into_iter()
        .find(|m| m.organisation_id == organisation_id)
        .ok_or(AppError::Forbidden("not a member of this organisation"))
}

pub async fn primary_membership(state: &AppState, user: &AuthUser) -> AppResult<Membership> {
    if let Some(first) = load_memberships(state, user).await?.into_iter().next() {
        return Ok(first);
    }
    if is_platform_admin(state, user).await? {
        let org = PgOrganisationRepo::new(state.db.clone())
            .list()
            .await?
            .into_iter()
            .next()
            .ok_or(AppError::NotFound("organisation"))?;
        return Ok(Membership {
            organisation_id: org.id,
            user_id: user.user_id,
            member_role: "admin".into(),
            name: org.name,
            slug: org.slug,
        });
    }
    Err(AppError::Forbidden("join an organisation first"))
}

pub fn parse_uuid(raw: &str, label: &'static str) -> AppResult<Uuid> {
    Uuid::parse_str(raw.trim()).map_err(|_| AppError::BadRequest(format!("invalid {label} id")))
}
