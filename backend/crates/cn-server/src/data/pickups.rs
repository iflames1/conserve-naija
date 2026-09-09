use chrono::{DateTime, Utc};
use cn_domain::{
    CollectionPointId, MaterialId, OrganisationId, PickupId, PickupStatus, UserId,
};
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

use crate::error::{AppError, AppResult};

#[derive(Debug, Clone)]
pub struct PickupRecord {
    pub id: PickupId,
    pub organisation_id: OrganisationId,
    pub collection_point_id: CollectionPointId,
    pub collection_point_name: String,
    pub material_id: MaterialId,
    pub material_name: String,
    pub material_slug: String,
    pub status: PickupStatus,
    pub threshold_grams: i64,
    pub inventory_grams_at_ready: i64,
    pub collected_grams: Option<i64>,
    pub accepted_by: Option<UserId>,
    pub accepted_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(sqlx::FromRow)]
struct PickupRow {
    id: Uuid,
    organisation_id: Uuid,
    collection_point_id: Uuid,
    collection_point_name: String,
    material_id: Uuid,
    material_name: String,
    material_slug: String,
    status: String,
    threshold_grams: i64,
    inventory_grams_at_ready: i64,
    collected_grams: Option<i64>,
    accepted_by: Option<Uuid>,
    accepted_at: Option<DateTime<Utc>>,
    completed_at: Option<DateTime<Utc>>,
    created_at: DateTime<Utc>,
}

pub struct PgPickupRepo {
    pool: PgPool,
}

impl PgPickupRepo {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn get(&self, id: PickupId) -> AppResult<Option<PickupRecord>> {
        let row = sqlx::query_as::<_, PickupRow>(sqlx::AssertSqlSafe(pickup_select("p.id = $1")))
            .bind(id.as_uuid())
            .fetch_optional(&self.pool)
            .await
            .map_err(|err| AppError::Internal(err.into()))?;
        row.map(into_pickup).transpose()
    }

    pub async fn list_for_org(
        &self,
        organisation_id: OrganisationId,
        status: Option<PickupStatus>,
    ) -> AppResult<Vec<PickupRecord>> {
        let rows = if let Some(status) = status {
            sqlx::query_as::<_, PickupRow>(sqlx::AssertSqlSafe(pickup_select(
                "p.organisation_id = $1 AND p.status = $2 ORDER BY p.created_at DESC",
            )))
            .bind(organisation_id.as_uuid())
            .bind(status.as_str())
            .fetch_all(&self.pool)
            .await
        } else {
            sqlx::query_as::<_, PickupRow>(sqlx::AssertSqlSafe(pickup_select(
                "p.organisation_id = $1 ORDER BY p.created_at DESC",
            )))
            .bind(organisation_id.as_uuid())
            .fetch_all(&self.pool)
            .await
        }
        .map_err(|err| AppError::Internal(err.into()))?;
        rows.into_iter().map(into_pickup).collect()
    }

    pub async fn ensure_ready_in_tx(
        tx: &mut Transaction<'_, Postgres>,
        organisation_id: OrganisationId,
        collection_point_id: CollectionPointId,
        material_id: MaterialId,
        threshold_grams: i64,
        inventory_grams: i64,
    ) -> AppResult<Option<PickupId>> {
        if inventory_grams < threshold_grams {
            return Ok(None);
        }
        let existing = sqlx::query_scalar::<_, Uuid>(
            r#"
            SELECT id FROM pickups
            WHERE collection_point_id = $1 AND material_id = $2
              AND status IN ('ready', 'accepted')
            LIMIT 1
            "#,
        )
        .bind(collection_point_id.as_uuid())
        .bind(material_id.as_uuid())
        .fetch_optional(&mut **tx)
        .await
        .map_err(|err| AppError::Internal(err.into()))?;
        if let Some(id) = existing {
            return Ok(Some(PickupId::from(id)));
        }

        let id = sqlx::query_scalar::<_, Uuid>(
            r#"
            INSERT INTO pickups (
                organisation_id, collection_point_id, material_id,
                status, threshold_grams, inventory_grams_at_ready
            )
            VALUES ($1, $2, $3, 'ready', $4, $5)
            ON CONFLICT DO NOTHING
            RETURNING id
            "#,
        )
        .bind(organisation_id.as_uuid())
        .bind(collection_point_id.as_uuid())
        .bind(material_id.as_uuid())
        .bind(threshold_grams)
        .bind(inventory_grams)
        .fetch_optional(&mut **tx)
        .await
        .map_err(|err| AppError::Internal(err.into()))?;
        Ok(id.map(PickupId::from))
    }

    pub async fn accept(&self, id: PickupId, user_id: UserId) -> AppResult<PickupRecord> {
        let updated = sqlx::query(
            r#"
            UPDATE pickups
            SET status = 'accepted', accepted_by = $2, accepted_at = now()
            WHERE id = $1 AND status = 'ready'
            "#,
        )
        .bind(id.as_uuid())
        .bind(user_id.as_uuid())
        .execute(&self.pool)
        .await
        .map_err(|err| AppError::Internal(err.into()))?;
        if updated.rows_affected() == 0 {
            return Err(AppError::Conflict("pickup is not ready to accept".into()));
        }
        self.get(id).await?.ok_or(AppError::NotFound("pickup"))
    }

    pub async fn complete_in_tx(
        tx: &mut Transaction<'_, Postgres>,
        id: PickupId,
        collected_grams: i64,
        collection_point_id: CollectionPointId,
        material_id: MaterialId,
    ) -> AppResult<()> {
        let updated = sqlx::query(
            r#"
            UPDATE pickups
            SET status = 'completed', collected_grams = $2, completed_at = now()
            WHERE id = $1 AND status = 'accepted'
            "#,
        )
        .bind(id.as_uuid())
        .bind(collected_grams)
        .execute(&mut **tx)
        .await
        .map_err(|err| AppError::Internal(err.into()))?;
        if updated.rows_affected() == 0 {
            return Err(AppError::Conflict("pickup is not accepted".into()));
        }

        sqlx::query(
            r#"
            UPDATE collection_point_inventory
            SET weight_grams = GREATEST(weight_grams - $3, 0),
                updated_at = now()
            WHERE collection_point_id = $1 AND material_id = $2
            "#,
        )
        .bind(collection_point_id.as_uuid())
        .bind(material_id.as_uuid())
        .bind(collected_grams)
        .execute(&mut **tx)
        .await
        .map_err(|err| AppError::Internal(err.into()))?;
        Ok(())
    }

    pub async fn cancel(&self, id: PickupId) -> AppResult<PickupRecord> {
        let updated = sqlx::query(
            r#"
            UPDATE pickups
            SET status = 'cancelled'
            WHERE id = $1 AND status IN ('ready', 'accepted')
            "#,
        )
        .bind(id.as_uuid())
        .execute(&self.pool)
        .await
        .map_err(|err| AppError::Internal(err.into()))?;
        if updated.rows_affected() == 0 {
            return Err(AppError::Conflict("pickup cannot be cancelled".into()));
        }
        self.get(id).await?.ok_or(AppError::NotFound("pickup"))
    }
}

fn pickup_select(where_clause: &str) -> String {
    format!(
        r#"
        SELECT p.id, p.organisation_id, p.collection_point_id, cp.name AS collection_point_name,
               p.material_id, m.name AS material_name, m.slug::text AS material_slug,
               p.status, p.threshold_grams, p.inventory_grams_at_ready, p.collected_grams,
               p.accepted_by, p.accepted_at, p.completed_at, p.created_at
        FROM pickups p
        JOIN collection_points cp ON cp.id = p.collection_point_id
        JOIN materials m ON m.id = p.material_id
        WHERE {where_clause}
        "#
    )
}

fn into_pickup(row: PickupRow) -> AppResult<PickupRecord> {
    Ok(PickupRecord {
        id: PickupId::from(row.id),
        organisation_id: OrganisationId::from(row.organisation_id),
        collection_point_id: CollectionPointId::from(row.collection_point_id),
        collection_point_name: row.collection_point_name,
        material_id: MaterialId::from(row.material_id),
        material_name: row.material_name,
        material_slug: row.material_slug,
        status: PickupStatus::parse(&row.status)
            .ok_or_else(|| AppError::Internal(anyhow::anyhow!("invalid pickup status")))?,
        threshold_grams: row.threshold_grams,
        inventory_grams_at_ready: row.inventory_grams_at_ready,
        collected_grams: row.collected_grams,
        accepted_by: row.accepted_by.map(UserId::from),
        accepted_at: row.accepted_at,
        completed_at: row.completed_at,
        created_at: row.created_at,
    })
}
