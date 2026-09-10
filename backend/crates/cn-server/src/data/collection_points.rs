use cn_domain::{
    CollectionPointId, CollectionPointStatus, Material, MaterialId, OrganisationId,
};
use sqlx::PgPool;
use uuid::Uuid;

use crate::error::{AppError, AppResult};

#[derive(Debug, Clone)]
pub struct CollectionPointRecord {
    pub id: CollectionPointId,
    pub organisation_id: OrganisationId,
    pub organisation_name: String,
    pub name: String,
    pub slug: String,
    pub address: String,
    pub description: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub status: CollectionPointStatus,
    pub default_pickup_threshold_grams: i64,
}

#[derive(Debug, Clone)]
pub struct InventoryRow {
    pub collection_point_id: CollectionPointId,
    pub material_id: MaterialId,
    pub material_name: String,
    pub material_slug: String,
    pub weight_grams: i64,
    pub pickup_threshold_grams: i64,
}

#[derive(sqlx::FromRow)]
struct PointRow {
    id: Uuid,
    organisation_id: Uuid,
    organisation_name: String,
    name: String,
    slug: String,
    address: String,
    description: Option<String>,
    latitude: Option<f64>,
    longitude: Option<f64>,
    status: String,
    default_pickup_threshold_grams: i64,
}

pub struct CreateCollectionPoint {
    pub organisation_id: OrganisationId,
    pub name: String,
    pub slug: String,
    pub address: String,
    pub description: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub threshold_grams: i64,
}

pub struct PgCollectionPointRepo {
    pool: PgPool,
}

impl PgCollectionPointRepo {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn list_public(&self) -> AppResult<Vec<CollectionPointRecord>> {
        let rows = sqlx::query_as::<_, PointRow>(
            r#"
            SELECT cp.id, cp.organisation_id, o.name AS organisation_name,
                   cp.name, cp.slug::text, cp.address, cp.description,
                   cp.latitude, cp.longitude, cp.status, cp.default_pickup_threshold_grams
            FROM collection_points cp
            JOIN organisations o ON o.id = cp.organisation_id
            WHERE cp.status = 'active' AND cp.slug = 'yaba'
            ORDER BY cp.name
            "#,
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|err| AppError::Internal(err.into()))?;
        rows.into_iter().map(into_point).collect()
    }

    pub async fn list_for_org(
        &self,
        organisation_id: OrganisationId,
    ) -> AppResult<Vec<CollectionPointRecord>> {
        let rows = sqlx::query_as::<_, PointRow>(
            r#"
            SELECT cp.id, cp.organisation_id, o.name AS organisation_name,
                   cp.name, cp.slug::text, cp.address, cp.description,
                   cp.latitude, cp.longitude, cp.status, cp.default_pickup_threshold_grams
            FROM collection_points cp
            JOIN organisations o ON o.id = cp.organisation_id
            WHERE cp.organisation_id = $1
            ORDER BY cp.name
            "#,
        )
        .bind(organisation_id.as_uuid())
        .fetch_all(&self.pool)
        .await
        .map_err(|err| AppError::Internal(err.into()))?;
        rows.into_iter().map(into_point).collect()
    }

    pub async fn get(&self, id: CollectionPointId) -> AppResult<Option<CollectionPointRecord>> {
        let row = sqlx::query_as::<_, PointRow>(
            r#"
            SELECT cp.id, cp.organisation_id, o.name AS organisation_name,
                   cp.name, cp.slug::text, cp.address, cp.description,
                   cp.latitude, cp.longitude, cp.status, cp.default_pickup_threshold_grams
            FROM collection_points cp
            JOIN organisations o ON o.id = cp.organisation_id
            WHERE cp.id = $1
            "#,
        )
        .bind(id.as_uuid())
        .fetch_optional(&self.pool)
        .await
        .map_err(|err| AppError::Internal(err.into()))?;
        match row {
            Some(row) => Ok(Some(into_point(row)?)),
            None => Ok(None),
        }
    }

    pub async fn create(&self, input: CreateCollectionPoint) -> AppResult<CollectionPointRecord> {
        let id: Uuid = sqlx::query_scalar(
            r#"
            INSERT INTO collection_points (
                organisation_id, name, slug, address, description,
                latitude, longitude, default_pickup_threshold_grams
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id
            "#,
        )
        .bind(input.organisation_id.as_uuid())
        .bind(&input.name)
        .bind(&input.slug)
        .bind(&input.address)
        .bind(&input.description)
        .bind(input.latitude)
        .bind(input.longitude)
        .bind(input.threshold_grams)
        .fetch_one(&self.pool)
        .await
        .map_err(|err| AppError::Internal(err.into()))?;
        self.get(CollectionPointId::from(id))
            .await?
            .ok_or_else(|| AppError::Internal(anyhow::anyhow!("collection point missing after insert")))
    }

    pub async fn supported_materials(
        &self,
        id: CollectionPointId,
    ) -> AppResult<Vec<Material>> {
        let rows = sqlx::query_as::<_, (Uuid, String, String, String, bool)>(
            r#"
            SELECT m.id, m.name, m.slug::text, m.unit, m.active
            FROM collection_point_materials cpm
            JOIN materials m ON m.id = cpm.material_id
            WHERE cpm.collection_point_id = $1
            ORDER BY m.name
            "#,
        )
        .bind(id.as_uuid())
        .fetch_all(&self.pool)
        .await
        .map_err(|err| AppError::Internal(err.into()))?;
        Ok(rows
            .into_iter()
            .map(|(id, name, slug, unit, active)| Material {
                id: MaterialId::from(id),
                name,
                slug,
                unit,
                active,
            })
            .collect())
    }

    pub async fn add_supported_material(
        &self,
        collection_point_id: CollectionPointId,
        material_id: MaterialId,
        threshold_grams: Option<i64>,
    ) -> AppResult<()> {
        sqlx::query(
            r#"
            INSERT INTO collection_point_materials (
                collection_point_id, material_id, pickup_threshold_grams
            )
            VALUES ($1, $2, $3)
            ON CONFLICT (collection_point_id, material_id) DO UPDATE
                SET pickup_threshold_grams = EXCLUDED.pickup_threshold_grams
            "#,
        )
        .bind(collection_point_id.as_uuid())
        .bind(material_id.as_uuid())
        .bind(threshold_grams)
        .execute(&self.pool)
        .await
        .map_err(|err| AppError::Internal(err.into()))?;

        sqlx::query(
            r#"
            INSERT INTO collection_point_inventory (collection_point_id, material_id, weight_grams)
            VALUES ($1, $2, 0)
            ON CONFLICT DO NOTHING
            "#,
        )
        .bind(collection_point_id.as_uuid())
        .bind(material_id.as_uuid())
        .execute(&self.pool)
        .await
        .map_err(|err| AppError::Internal(err.into()))?;
        Ok(())
    }

    pub async fn supports_material(
        &self,
        collection_point_id: CollectionPointId,
        material_id: MaterialId,
    ) -> AppResult<bool> {
        let found = sqlx::query_scalar::<_, bool>(
            r#"
            SELECT EXISTS(
                SELECT 1 FROM collection_point_materials
                WHERE collection_point_id = $1 AND material_id = $2
            )
            "#,
        )
        .bind(collection_point_id.as_uuid())
        .bind(material_id.as_uuid())
        .fetch_one(&self.pool)
        .await
        .map_err(|err| AppError::Internal(err.into()))?;
        Ok(found)
    }

    pub async fn inventory_for_org(
        &self,
        organisation_id: OrganisationId,
    ) -> AppResult<Vec<InventoryRow>> {
        self.inventory(Some(organisation_id), None).await
    }

    pub async fn inventory_for_point(
        &self,
        collection_point_id: CollectionPointId,
    ) -> AppResult<Vec<InventoryRow>> {
        self.inventory(None, Some(collection_point_id)).await
    }

    async fn inventory(
        &self,
        organisation_id: Option<OrganisationId>,
        collection_point_id: Option<CollectionPointId>,
    ) -> AppResult<Vec<InventoryRow>> {
        let rows = sqlx::query_as::<_, (Uuid, Uuid, String, String, i64, i64)>(
            r#"
            SELECT i.collection_point_id, i.material_id, m.name, m.slug::text, i.weight_grams,
                   COALESCE(cpm.pickup_threshold_grams, cp.default_pickup_threshold_grams)
            FROM collection_point_inventory i
            JOIN materials m ON m.id = i.material_id
            JOIN collection_points cp ON cp.id = i.collection_point_id
            LEFT JOIN collection_point_materials cpm
                ON cpm.collection_point_id = i.collection_point_id
               AND cpm.material_id = i.material_id
            WHERE ($1::uuid IS NULL OR cp.organisation_id = $1)
              AND ($2::uuid IS NULL OR i.collection_point_id = $2)
            ORDER BY cp.name, m.name
            "#,
        )
        .bind(organisation_id.map(|id| id.as_uuid()))
        .bind(collection_point_id.map(|id| id.as_uuid()))
        .fetch_all(&self.pool)
        .await
        .map_err(|err| AppError::Internal(err.into()))?;
        Ok(rows
            .into_iter()
            .map(
                |(
                    collection_point_id,
                    material_id,
                    material_name,
                    material_slug,
                    weight_grams,
                    pickup_threshold_grams,
                )| InventoryRow {
                    collection_point_id: CollectionPointId::from(collection_point_id),
                    material_id: MaterialId::from(material_id),
                    material_name,
                    material_slug,
                    weight_grams,
                    pickup_threshold_grams,
                },
            )
            .collect())
    }

    pub async fn update_threshold(
        &self,
        collection_point_id: CollectionPointId,
        grams: i64,
    ) -> AppResult<()> {
        let updated = sqlx::query(
            r#"
            UPDATE collection_points
            SET default_pickup_threshold_grams = $2, updated_at = now()
            WHERE id = $1
            "#,
        )
        .bind(collection_point_id.as_uuid())
        .bind(grams)
        .execute(&self.pool)
        .await
        .map_err(|err| AppError::Internal(err.into()))?;
        if updated.rows_affected() == 0 {
            return Err(AppError::NotFound("collection point"));
        }
        Ok(())
    }
}

fn into_point(row: PointRow) -> AppResult<CollectionPointRecord> {
    Ok(CollectionPointRecord {
        id: CollectionPointId::from(row.id),
        organisation_id: OrganisationId::from(row.organisation_id),
        organisation_name: row.organisation_name,
        name: row.name,
        slug: row.slug,
        address: row.address,
        description: row.description,
        latitude: row.latitude,
        longitude: row.longitude,
        status: CollectionPointStatus::parse(&row.status)
            .ok_or_else(|| AppError::Internal(anyhow::anyhow!("invalid collection point status")))?,
        default_pickup_threshold_grams: row.default_pickup_threshold_grams,
    })
}
