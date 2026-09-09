use axum::Json;
use axum::Router;
use axum::extract::{Path, State};
use axum::routing::get;

use crate::data::collection_points::PgCollectionPointRepo;
use crate::data::materials::PgMaterialRepo;
use crate::error::{AppError, AppResult};
use crate::routes::access::parse_uuid;
use crate::routes::dto::{
    CollectionPointResponse, MaterialResponse, inventory_dto, point_dto,
};
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/collection-points", get(list_points))
        .route("/collection-points/{id}", get(get_point))
}

async fn list_points(
    State(state): State<AppState>,
) -> AppResult<Json<Vec<CollectionPointResponse>>> {
    let repo = PgCollectionPointRepo::new(state.db.clone());
    let points = repo.list_public().await?;
    let mut out = Vec::new();
    for point in points {
        out.push(hydrate_point(&state, &repo, &point).await?);
    }
    Ok(Json(out))
}

async fn get_point(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<Json<CollectionPointResponse>> {
    let repo = PgCollectionPointRepo::new(state.db.clone());
    let point = repo
        .get(parse_uuid(&id, "collection point")?.into())
        .await?
        .ok_or(AppError::NotFound("collection point"))?;
    Ok(Json(hydrate_point(&state, &repo, &point).await?))
}

pub(crate) async fn hydrate_point(
    state: &AppState,
    repo: &PgCollectionPointRepo,
    point: &crate::data::collection_points::CollectionPointRecord,
) -> AppResult<CollectionPointResponse> {
    let materials_repo = PgMaterialRepo::new(state.db.clone());
    let (materials, prices, inventory) = tokio::try_join!(
        repo.supported_materials(point.id),
        materials_repo.list_current_prices(point.organisation_id),
        repo.inventory_for_point(point.id),
    )?;
    let material_dtos = materials
        .into_iter()
        .map(|material| {
            let price = prices
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
        .collect();
    Ok(point_dto(
        point,
        material_dtos,
        inventory.iter().map(inventory_dto).collect(),
    ))
}
