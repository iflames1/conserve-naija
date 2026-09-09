use axum::Json;
use axum::Router;
use axum::extract::State;
use axum::routing::{get, post};
use serde::Deserialize;

use crate::auth::AuthUser;
use crate::data::deposits::PgDepositRepo;
use crate::data::users::{PgUserRepo, UpsertUserInput};
use crate::error::{AppError, AppResult};
use crate::data::organisations::PgOrganisationRepo;
use crate::routes::access::{is_platform_admin, load_memberships};
use crate::routes::dto::{UserResponse, ledger_dto};
use crate::services::jwt::parse_jwt_sub;
use crate::state::AppState;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertUserBody {
    pub id: String,
    pub email: String,
    pub display_name: Option<String>,
    pub avatar_url: Option<String>,
    pub email_verified: Option<bool>,
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/users", post(upsert_user))
        .route("/me", get(me))
        .route("/me/deposits", get(my_deposits))
        .route("/me/rewards", get(my_rewards))
        .route("/me/rewards/transactions", get(my_transactions))
}

async fn upsert_user(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<UpsertUserBody>,
) -> AppResult<Json<UserResponse>> {
    let id = parse_jwt_sub(&body.id)?;
    auth.require_self(id)?;
    let email = body.email.trim().to_lowercase();
    if email.is_empty() || !email.contains('@') {
        return Err(AppError::BadRequest("email is required".into()));
    }
    let display_name = body
        .display_name
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| email.split('@').next().unwrap_or("Citizen"))
        .to_owned();

    let repo = PgUserRepo::new(state.db.clone());
    let user = repo
        .upsert(UpsertUserInput {
            id: auth.user_id,
            email,
            display_name,
            avatar_url: body.avatar_url,
            email_verified: body.email_verified.unwrap_or(auth.email_verified),
        })
        .await?;
    json_user(&state, &auth, user).await
}

async fn me(State(state): State<AppState>, auth: AuthUser) -> AppResult<Json<UserResponse>> {
    let repo = PgUserRepo::new(state.db.clone());
    let user = repo
        .get_by_id(auth.user_id)
        .await?
        .ok_or(AppError::NotFound("user"))?;
    json_user(&state, &auth, user).await
}

async fn my_deposits(
    State(state): State<AppState>,
    auth: AuthUser,
) -> AppResult<Json<Vec<crate::routes::dto::DepositResponse>>> {
    let rows = PgDepositRepo::new(state.db.clone())
        .list_for_user(auth.user_id, 50, 0)
        .await?;
    Ok(Json(
        rows.iter()
            .map(|d| crate::routes::dto::deposit_dto(d, None))
            .collect(),
    ))
}

async fn my_rewards(
    State(state): State<AppState>,
    auth: AuthUser,
) -> AppResult<Json<serde_json::Value>> {
    let user = PgUserRepo::new(state.db.clone())
        .get_by_id(auth.user_id)
        .await?
        .ok_or(AppError::NotFound("user"))?;
    Ok(Json(serde_json::json!({
        "greenPointsBalance": user.green_points_balance,
        "nairaValue": user.green_points_balance,
        "conversion": "1 Green Point = ₦1"
    })))
}

async fn my_transactions(
    State(state): State<AppState>,
    auth: AuthUser,
) -> AppResult<Json<Vec<crate::routes::dto::LedgerResponse>>> {
    let rows = PgDepositRepo::new(state.db.clone())
        .list_transactions(auth.user_id, 50, 0)
        .await?;
    Ok(Json(rows.iter().map(ledger_dto).collect()))
}

async fn json_user(
    state: &AppState,
    auth: &AuthUser,
    user: cn_domain::User,
) -> AppResult<Json<UserResponse>> {
    let repo = PgUserRepo::new(state.db.clone());
    let mut orgs: Vec<crate::routes::dto::OrgMembershipResponse> = load_memberships(state, auth)
        .await?
        .into_iter()
        .map(|m| crate::routes::dto::OrgMembershipResponse {
            id: m.organisation_id.to_string(),
            name: m.name,
            slug: m.slug,
            member_role: m.member_role,
        })
        .collect();
    if orgs.is_empty() && is_platform_admin(state, auth).await? {
        if let Some(org) = PgOrganisationRepo::new(state.db.clone())
            .list()
            .await?
            .into_iter()
            .next()
        {
            orgs.push(crate::routes::dto::OrgMembershipResponse {
                id: org.id.to_string(),
                name: org.name,
                slug: org.slug,
                member_role: "admin".into(),
            });
        }
    }
    let (deposit_count, recycled_grams) = repo.recycling_stats(user.id).await?;
    Ok(Json(UserResponse {
        id: user.id.to_string(),
        email: user.email,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        email_verified: user.email_verified,
        created_at: user.created_at,
        green_points_balance: user.green_points_balance,
        naira_value: user.green_points_balance,
        deposit_count,
        recycled_kg: cn_domain::kg_from_grams(recycled_grams),
        roles: user.roles.iter().map(|r| r.as_str().to_owned()).collect(),
        organisations: orgs,
    }))
}
