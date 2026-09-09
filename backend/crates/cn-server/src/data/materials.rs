use chrono::{DateTime, Utc};
use cn_domain::{Material, MaterialId, OrganisationId};
use sqlx::PgPool;
use uuid::Uuid;

use crate::error::{AppError, AppResult};

#[derive(sqlx::FromRow)]
struct MaterialRow {
    id: Uuid,
    name: String,
    slug: String,
    unit: String,
    active: bool,
}

#[derive(Debug, Clone)]
pub struct MaterialPrice {
    pub organisation_id: OrganisationId,
    pub material_id: MaterialId,
    pub price_per_kg_naira: i64,
    pub effective_from: DateTime<Utc>,
}

pub struct PgMaterialRepo {
    pool: PgPool,
}

impl PgMaterialRepo {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn list(&self, active_only: bool) -> AppResult<Vec<Material>> {
        let rows = if active_only {
            sqlx::query_as::<_, MaterialRow>(
                "SELECT id, name, slug::text, unit, active FROM materials WHERE active = true ORDER BY name",
            )
            .fetch_all(&self.pool)
            .await
        } else {
            sqlx::query_as::<_, MaterialRow>(
                "SELECT id, name, slug::text, unit, active FROM materials ORDER BY name",
            )
            .fetch_all(&self.pool)
            .await
        }
        .map_err(|err| AppError::Internal(err.into()))?;
        Ok(rows.into_iter().map(into_material).collect())
    }

    pub async fn get(&self, id: MaterialId) -> AppResult<Option<Material>> {
        let row = sqlx::query_as::<_, MaterialRow>(
            "SELECT id, name, slug::text, unit, active FROM materials WHERE id = $1",
        )
        .bind(id.as_uuid())
        .fetch_optional(&self.pool)
        .await
        .map_err(|err| AppError::Internal(err.into()))?;
        Ok(row.map(into_material))
    }

    pub async fn get_by_slug(&self, slug: &str) -> AppResult<Option<Material>> {
        let row = sqlx::query_as::<_, MaterialRow>(
            "SELECT id, name, slug::text, unit, active FROM materials WHERE slug = $1",
        )
        .bind(slug)
        .fetch_optional(&self.pool)
        .await
        .map_err(|err| AppError::Internal(err.into()))?;
        Ok(row.map(into_material))
    }

    pub async fn create(&self, name: &str, slug: &str, unit: &str) -> AppResult<Material> {
        let row = sqlx::query_as::<_, MaterialRow>(
            r#"
            INSERT INTO materials (name, slug, unit, active)
            VALUES ($1, $2, $3, true)
            RETURNING id, name, slug::text, unit, active
            "#,
        )
        .bind(name)
        .bind(slug)
        .bind(unit)
        .fetch_one(&self.pool)
        .await
        .map_err(|err| AppError::Internal(err.into()))?;
        Ok(into_material(row))
    }

    pub async fn current_price(
        &self,
        organisation_id: OrganisationId,
        material_id: MaterialId,
    ) -> AppResult<Option<MaterialPrice>> {
        let row = sqlx::query_as::<_, (Uuid, Uuid, i64, DateTime<Utc>)>(
            r#"
            SELECT organisation_id, material_id, price_per_kg_naira, effective_from
            FROM material_prices
            WHERE organisation_id = $1 AND material_id = $2
            ORDER BY effective_from DESC
            LIMIT 1
            "#,
        )
        .bind(organisation_id.as_uuid())
        .bind(material_id.as_uuid())
        .fetch_optional(&self.pool)
        .await
        .map_err(|err| AppError::Internal(err.into()))?;
        Ok(row.map(|(organisation_id, material_id, price_per_kg_naira, effective_from)| {
            MaterialPrice {
                organisation_id: OrganisationId::from(organisation_id),
                material_id: MaterialId::from(material_id),
                price_per_kg_naira,
                effective_from,
            }
        }))
    }

    pub async fn insert_price(
        &self,
        organisation_id: OrganisationId,
        material_id: MaterialId,
        price_per_kg_naira: i64,
        created_by: Option<Uuid>,
    ) -> AppResult<MaterialPrice> {
        let row = sqlx::query_as::<_, (Uuid, Uuid, i64, DateTime<Utc>)>(
            r#"
            INSERT INTO material_prices (
                organisation_id, material_id, price_per_kg_naira, created_by
            )
            VALUES ($1, $2, $3, $4)
            RETURNING organisation_id, material_id, price_per_kg_naira, effective_from
            "#,
        )
        .bind(organisation_id.as_uuid())
        .bind(material_id.as_uuid())
        .bind(price_per_kg_naira)
        .bind(created_by)
        .fetch_one(&self.pool)
        .await
        .map_err(|err| AppError::Internal(err.into()))?;
        Ok(MaterialPrice {
            organisation_id: OrganisationId::from(row.0),
            material_id: MaterialId::from(row.1),
            price_per_kg_naira: row.2,
            effective_from: row.3,
        })
    }

    pub async fn list_current_prices(
        &self,
        organisation_id: OrganisationId,
    ) -> AppResult<Vec<(Material, i64)>> {
        let rows = sqlx::query_as::<_, (Uuid, String, String, String, bool, i64)>(
            r#"
            SELECT m.id, m.name, m.slug::text, m.unit, m.active, p.price_per_kg_naira
            FROM materials m
            JOIN LATERAL (
                SELECT price_per_kg_naira
                FROM material_prices
                WHERE organisation_id = $1 AND material_id = m.id
                ORDER BY effective_from DESC
                LIMIT 1
            ) p ON true
            ORDER BY m.name
            "#,
        )
        .bind(organisation_id.as_uuid())
        .fetch_all(&self.pool)
        .await
        .map_err(|err| AppError::Internal(err.into()))?;
        Ok(rows
            .into_iter()
            .map(|(id, name, slug, unit, active, price)| {
                (
                    Material {
                        id: MaterialId::from(id),
                        name,
                        slug,
                        unit,
                        active,
                    },
                    price,
                )
            })
            .collect())
    }
}

fn into_material(row: MaterialRow) -> Material {
    Material {
        id: MaterialId::from(row.id),
        name: row.name,
        slug: row.slug,
        unit: row.unit,
        active: row.active,
    }
}
