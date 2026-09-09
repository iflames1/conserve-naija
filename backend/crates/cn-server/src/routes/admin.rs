use axum::Json;
use axum::Router;
use axum::extract::State;
use axum::routing::{get, post};
use cn_domain::UserRole;
use serde::Deserialize;

use crate::auth::AuthUser;
use crate::data::collection_points::{CreateCollectionPoint, PgCollectionPointRepo};
use crate::data::materials::PgMaterialRepo;
use crate::data::organisations::PgOrganisationRepo;
use crate::data::users::PgUserRepo;
use crate::error::{AppError, AppResult};
use crate::routes::access::{parse_uuid, require_platform_admin};
use crate::state::AppState;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateOrgBody {
    name: String,
    slug: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreatePointBody {
    organisation_id: String,
    name: String,
    slug: String,
    address: String,
    description: Option<String>,
    latitude: Option<f64>,
    longitude: Option<f64>,
    threshold_kg: Option<f64>,
    material_ids: Option<Vec<String>>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateMaterialBody {
    name: String,
    slug: String,
    unit: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AddMemberBody {
    organisation_id: String,
    email: String,
    member_role: Option<String>,
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/admin/organisations", get(list_orgs).post(create_org))
        .route("/admin/collection-points", post(create_point))
        .route("/admin/materials", post(create_material))
        .route("/admin/members", post(add_member))
}

async fn list_orgs(
    State(state): State<AppState>,
    auth: AuthUser,
) -> AppResult<Json<Vec<cn_domain::Organisation>>> {
    require_platform_admin(&state, &auth).await?;
    Ok(Json(PgOrganisationRepo::new(state.db.clone()).list().await?))
}

async fn create_org(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<CreateOrgBody>,
) -> AppResult<Json<cn_domain::Organisation>> {
    require_platform_admin(&state, &auth).await?;
    let name = body.name.trim();
    let slug = body.slug.trim().to_lowercase();
    if name.is_empty() || slug.is_empty() {
        return Err(AppError::BadRequest("name and slug are required".into()));
    }
    Ok(Json(
        PgOrganisationRepo::new(state.db.clone())
            .create(name, &slug)
            .await?,
    ))
}

async fn create_point(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<CreatePointBody>,
) -> AppResult<Json<serde_json::Value>> {
    require_platform_admin(&state, &auth).await?;
    let threshold = match body.threshold_kg {
        Some(kg) => cn_domain::grams_from_kg(kg).map_err(|err| AppError::BadRequest(err.to_string()))?,
        None => 10_000,
    };
    let repo = PgCollectionPointRepo::new(state.db.clone());
    let point = repo
        .create(CreateCollectionPoint {
            organisation_id: parse_uuid(&body.organisation_id, "organisation")?.into(),
            name: body.name.trim().to_owned(),
            slug: body.slug.trim().to_lowercase(),
            address: body.address.trim().to_owned(),
            description: body.description,
            latitude: body.latitude,
            longitude: body.longitude,
            threshold_grams: threshold,
        })
        .await?;
    if let Some(ids) = body.material_ids {
        for id in ids {
            repo.add_supported_material(point.id, parse_uuid(&id, "material")?.into(), None)
                .await?;
        }
    }
    Ok(Json(serde_json::json!({ "id": point.id })))
}

async fn create_material(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<CreateMaterialBody>,
) -> AppResult<Json<cn_domain::Material>> {
    require_platform_admin(&state, &auth).await?;
    Ok(Json(
        PgMaterialRepo::new(state.db.clone())
            .create(
                body.name.trim(),
                &body.slug.trim().to_lowercase(),
                body.unit.as_deref().unwrap_or("kg"),
            )
            .await?,
    ))
}

async fn add_member(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<AddMemberBody>,
) -> AppResult<Json<serde_json::Value>> {
    require_platform_admin(&state, &auth).await?;
    let user = PgUserRepo::new(state.db.clone())
        .get_by_email(body.email.trim())
        .await?
        .ok_or(AppError::NotFound("user"))?;
    PgOrganisationRepo::new(state.db.clone())
        .add_member(
            parse_uuid(&body.organisation_id, "organisation")?.into(),
            user.id,
            body.member_role.as_deref().unwrap_or("member"),
        )
        .await?;
    PgUserRepo::new(state.db.clone())
        .grant_role(user.id, UserRole::OrganisationMember)
        .await?;
    Ok(Json(serde_json::json!({ "ok": true, "userId": user.id })))
}
