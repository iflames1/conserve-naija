use axum::Json;
use axum::Router;
use axum::extract::{Query, State};
use axum::routing::{get, post};
use cn_domain::{PickupStatus, kg_from_grams};
use serde::Deserialize;
use crate::auth::AuthUser;
use crate::data::collection_points::PgCollectionPointRepo;
use crate::data::deposits::PgDepositRepo;
use crate::data::devices::PgDeviceRepo;
use crate::data::materials::PgMaterialRepo;
use crate::data::pickups::PgPickupRepo;
use crate::device_auth::{generate_api_key, hash_api_key};
use crate::error::{AppError, AppResult};
use crate::routes::access::{parse_uuid, primary_membership, require_org_access};
use crate::routes::admin::add_or_invite_member;
use crate::routes::collection_points::hydrate_point;
use crate::routes::dto::{
    DeviceResponse, MaterialResponse, OrganisationOverview, PickupResponse, device_dto,
    inventory_dto, pickup_dto,
};
use crate::state::AppState;

#[derive(Deserialize)]
struct OrgQuery {
    organisation_id: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RegisterDeviceBody {
    external_id: String,
    device_type: Option<String>,
    firmware_version: Option<String>,
    collection_point_id: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreatePointBody {
    name: String,
    address: String,
    description: Option<String>,
    latitude: Option<f64>,
    longitude: Option<f64>,
    threshold_kg: Option<f64>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AssociateDeviceBody {
    device_id: String,
    collection_point_id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PriceBody {
    material_id: String,
    price_per_kg_naira: i64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ThresholdBody {
    collection_point_id: String,
    threshold_kg: f64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AddOrgMemberBody {
    email: String,
    member_role: Option<String>,
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/organisation", get(overview))
        .route(
            "/organisation/collection-points",
            get(org_points).post(create_point),
        )
        .route("/organisation/sites", get(org_points).post(create_point))
        .route("/organisation/devices", get(org_devices).post(register_device))
        .route("/organisation/devices/associate", post(associate_device))
        .route(
            "/organisation/devices/{id}/deactivate",
            post(deactivate_device),
        )
        .route("/organisation/inventory", get(org_inventory))
        .route("/organisation/pickups", get(org_pickups))
        .route("/organisation/deposits", get(org_deposits))
        .route("/organisation/materials", get(org_materials))
        .route("/organisation/material-prices", post(set_price))
        .route("/organisation/pickup-threshold", post(set_threshold))
        .route("/organisation/members", post(add_org_member))
}

async fn resolve_org(
    state: &AppState,
    user: &AuthUser,
    query: &OrgQuery,
) -> AppResult<crate::data::organisations::Membership> {
    if let Some(id) = &query.organisation_id {
        require_org_access(state, user, parse_uuid(id, "organisation")?.into()).await
    } else {
        primary_membership(state, user).await
    }
}

async fn overview(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(query): Query<OrgQuery>,
) -> AppResult<Json<OrganisationOverview>> {
    let membership = resolve_org(&state, &auth, &query).await?;
    let points = PgCollectionPointRepo::new(state.db.clone())
        .list_for_org(membership.organisation_id)
        .await?;
    let devices = PgDeviceRepo::new(state.db.clone())
        .list_for_org(membership.organisation_id)
        .await?;
    let now = chrono::Utc::now();
    let online = devices
        .iter()
        .filter(|d| {
            cn_domain::DeviceHealth::from_last_seen(d.last_seen_at, now)
                == cn_domain::DeviceHealth::Online
        })
        .count() as i64;
    let inventory = PgCollectionPointRepo::new(state.db.clone())
        .inventory_for_org(membership.organisation_id)
        .await?;
    let collected: i64 = inventory.iter().map(|row| row.weight_grams).sum();
    let pickups = PgPickupRepo::new(state.db.clone())
        .list_for_org(membership.organisation_id, Some(PickupStatus::Ready))
        .await?;
    Ok(Json(OrganisationOverview {
        organisation_id: membership.organisation_id.to_string(),
        name: membership.name,
        collection_points: points.len() as i64,
        sites: points.len() as i64,
        devices_online: online,
        devices_total: devices.len() as i64,
        material_collected_kg: kg_from_grams(collected),
        ready_for_pickup: pickups.len() as i64,
    }))
}

async fn org_points(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(query): Query<OrgQuery>,
) -> AppResult<Json<Vec<crate::routes::dto::CollectionPointResponse>>> {
    let membership = resolve_org(&state, &auth, &query).await?;
    let repo = PgCollectionPointRepo::new(state.db.clone());
    let points = repo.list_for_org(membership.organisation_id).await?;
    let mut out = Vec::new();
    for point in points {
        out.push(hydrate_point(&state, &repo, &point).await?);
    }
    Ok(Json(out))
}

async fn org_devices(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(query): Query<OrgQuery>,
) -> AppResult<Json<Vec<DeviceResponse>>> {
    let membership = resolve_org(&state, &auth, &query).await?;
    let repo = PgDeviceRepo::new(state.db.clone());
    let devices = repo.list_for_org(membership.organisation_id).await?;
    let now = chrono::Utc::now();
    let mut out = Vec::new();
    for device in devices {
        let bins = repo.latest_bins(device.id).await?;
        out.push(device_dto(&device, bins, now));
    }
    Ok(Json(out))
}

async fn register_device(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(query): Query<OrgQuery>,
    Json(body): Json<RegisterDeviceBody>,
) -> AppResult<Json<serde_json::Value>> {
    let membership = resolve_org(&state, &auth, &query).await?;
    let external_id = body.external_id.trim();
    if external_id.is_empty() {
        return Err(AppError::BadRequest("device id is required".into()));
    }
    let api_key = generate_api_key();
    let device = PgDeviceRepo::new(state.db.clone())
        .register(
            membership.organisation_id,
            external_id,
            body.device_type.as_deref().unwrap_or("bin_scale"),
            &hash_api_key(&api_key),
            body.firmware_version.as_deref(),
        )
        .await?;
    if let Some(point_id) = body.collection_point_id.as_deref() {
        let point = PgCollectionPointRepo::new(state.db.clone())
            .get(parse_uuid(point_id, "collection point")?.into())
            .await?
            .ok_or(AppError::NotFound("collection point"))?;
        if point.organisation_id != device.organisation_id {
            return Err(AppError::Forbidden(
                "device and collection point belong to different organisations",
            ));
        }
        PgDeviceRepo::new(state.db.clone())
            .associate(device.id, point.id)
            .await?;
    }
    let device = PgDeviceRepo::new(state.db.clone())
        .get(device.id)
        .await?
        .ok_or(AppError::NotFound("device"))?;
    Ok(Json(serde_json::json!({
        "device": device_dto(&device, Vec::new(), chrono::Utc::now()),
        "apiKey": api_key
    })))
}

async fn associate_device(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<AssociateDeviceBody>,
) -> AppResult<Json<serde_json::Value>> {
    let device_id = parse_uuid(&body.device_id, "device")?;
    let point_id = parse_uuid(&body.collection_point_id, "collection point")?;
    let device = PgDeviceRepo::new(state.db.clone())
        .get(device_id.into())
        .await?
        .ok_or(AppError::NotFound("device"))?;
    require_org_access(&state, &auth, device.organisation_id).await?;
    let point = PgCollectionPointRepo::new(state.db.clone())
        .get(point_id.into())
        .await?
        .ok_or(AppError::NotFound("collection point"))?;
    if point.organisation_id != device.organisation_id {
        return Err(AppError::Forbidden(
            "device and collection point belong to different organisations",
        ));
    }
    PgDeviceRepo::new(state.db.clone())
        .associate(device.id, point.id)
        .await?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

async fn deactivate_device(
    State(state): State<AppState>,
    auth: AuthUser,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> AppResult<Json<serde_json::Value>> {
    let device = PgDeviceRepo::new(state.db.clone())
        .get(parse_uuid(&id, "device")?.into())
        .await?
        .ok_or(AppError::NotFound("device"))?;
    require_org_access(&state, &auth, device.organisation_id).await?;
    PgDeviceRepo::new(state.db.clone())
        .set_status(device.id, "disabled")
        .await?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

async fn create_point(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(query): Query<OrgQuery>,
    Json(body): Json<CreatePointBody>,
) -> AppResult<Json<crate::routes::dto::CollectionPointResponse>> {
    let membership = resolve_org(&state, &auth, &query).await?;
    let name = body.name.trim();
    if name.is_empty() {
        return Err(AppError::BadRequest("name is required".into()));
    }
    let address = body.address.trim();
    if address.is_empty() {
        return Err(AppError::BadRequest("address is required".into()));
    }
    let threshold = body
        .threshold_kg
        .map(cn_domain::grams_from_kg)
        .transpose()
        .map_err(|err| AppError::BadRequest(err.to_string()))?
        .unwrap_or(5_000);
    let repo = PgCollectionPointRepo::new(state.db.clone());
    let point = repo
        .create(crate::data::collection_points::CreateCollectionPoint {
            organisation_id: membership.organisation_id,
            name: name.to_owned(),
            slug: slugify(name),
            address: address.to_owned(),
            description: body.description,
            latitude: body.latitude,
            longitude: body.longitude,
            threshold_grams: threshold,
        })
        .await?;
    for material in PgMaterialRepo::new(state.db.clone()).list(true).await? {
        repo.add_supported_material(point.id, material.id, Some(threshold))
            .await?;
    }
    hydrate_point(&state, &repo, &point).await.map(Json)
}

fn slugify(value: &str) -> String {
    let mut slug = String::new();
    let mut dash = false;
    for ch in value.chars() {
        if ch.is_ascii_alphanumeric() {
            slug.push(ch.to_ascii_lowercase());
            dash = false;
        } else if !dash && !slug.is_empty() {
            slug.push('-');
            dash = true;
        }
    }
    let slug = slug.trim_matches('-').to_owned();
    if slug.is_empty() {
        format!("point-{}", uuid::Uuid::now_v7().simple())
    } else {
        slug
    }
}

async fn org_inventory(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(query): Query<OrgQuery>,
) -> AppResult<Json<Vec<crate::routes::dto::InventoryResponse>>> {
    let membership = resolve_org(&state, &auth, &query).await?;
    let rows = PgCollectionPointRepo::new(state.db.clone())
        .inventory_for_org(membership.organisation_id)
        .await?;
    Ok(Json(rows.iter().map(inventory_dto).collect()))
}

async fn org_pickups(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(query): Query<OrgQuery>,
) -> AppResult<Json<Vec<PickupResponse>>> {
    let membership = resolve_org(&state, &auth, &query).await?;
    let rows = PgPickupRepo::new(state.db.clone())
        .list_for_org(membership.organisation_id, None)
        .await?;
    Ok(Json(rows.iter().map(pickup_dto).collect()))
}

async fn org_deposits(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(query): Query<OrgQuery>,
) -> AppResult<Json<Vec<crate::routes::dto::DepositResponse>>> {
    let membership = resolve_org(&state, &auth, &query).await?;
    let rows = PgDepositRepo::new(state.db.clone())
        .list_for_org(membership.organisation_id, 50)
        .await?;
    Ok(Json(
        rows.iter()
            .map(|d| crate::routes::dto::deposit_dto(d, None))
            .collect(),
    ))
}

async fn org_materials(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(query): Query<OrgQuery>,
) -> AppResult<Json<Vec<MaterialResponse>>> {
    let membership = resolve_org(&state, &auth, &query).await?;
    let priced = PgMaterialRepo::new(state.db.clone())
        .list_current_prices(membership.organisation_id)
        .await?;
    let all = PgMaterialRepo::new(state.db.clone()).list(false).await?;
    Ok(Json(
        all.into_iter()
            .map(|material| {
                let price = priced
                    .iter()
                    .find(|(m, _)| m.id == material.id)
                    .map(|(_, p)| *p);
                MaterialResponse {
                    id: material.id.to_string(),
                    name: material.name,
                    slug: material.slug,
                    unit: material.unit,
                    active: material.active,
                    price_per_kg_naira: price,
                }
            })
            .collect(),
    ))
}

async fn set_price(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(query): Query<OrgQuery>,
    Json(body): Json<PriceBody>,
) -> AppResult<Json<serde_json::Value>> {
    let membership = resolve_org(&state, &auth, &query).await?;
    if body.price_per_kg_naira < 0 {
        return Err(AppError::BadRequest("price cannot be negative".into()));
    }
    let price = PgMaterialRepo::new(state.db.clone())
        .insert_price(
            membership.organisation_id,
            parse_uuid(&body.material_id, "material")?.into(),
            body.price_per_kg_naira,
            Some(auth.user_id.as_uuid()),
        )
        .await?;
    Ok(Json(serde_json::json!({
        "materialId": price.material_id,
        "pricePerKgNaira": price.price_per_kg_naira,
        "effectiveFrom": price.effective_from
    })))
}

async fn set_threshold(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<ThresholdBody>,
) -> AppResult<Json<serde_json::Value>> {
    let point = PgCollectionPointRepo::new(state.db.clone())
        .get(parse_uuid(&body.collection_point_id, "collection point")?.into())
        .await?
        .ok_or(AppError::NotFound("collection point"))?;
    require_org_access(&state, &auth, point.organisation_id).await?;
    let grams = cn_domain::grams_from_kg(body.threshold_kg)
        .map_err(|err| AppError::BadRequest(err.to_string()))?;
    PgCollectionPointRepo::new(state.db.clone())
        .update_threshold(point.id, grams)
        .await?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

async fn add_org_member(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(query): Query<OrgQuery>,
    Json(body): Json<AddOrgMemberBody>,
) -> AppResult<Json<serde_json::Value>> {
    let membership = resolve_org(&state, &auth, &query).await?;
    add_or_invite_member(
        &state,
        membership.organisation_id,
        &body.email,
        body.member_role.as_deref().unwrap_or("member"),
    )
    .await
}
