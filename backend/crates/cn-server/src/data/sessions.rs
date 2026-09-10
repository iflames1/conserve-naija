use chrono::{DateTime, Utc};
use cn_domain::{
    CollectionPointId, DepositId, DeviceId, MaterialId, OrganisationId, RecyclingSessionId,
    RecyclingSessionStatus, UserId,
};
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

use crate::error::{AppError, AppResult};

#[derive(Debug, Clone)]
pub struct SessionRecord {
    pub id: RecyclingSessionId,
    pub user_id: UserId,
    pub code: String,
    pub status: RecyclingSessionStatus,
    pub device_id: Option<DeviceId>,
    pub device_external_id: Option<String>,
    pub collection_point_id: Option<CollectionPointId>,
    pub collection_point_name: Option<String>,
    pub organisation_id: Option<OrganisationId>,
    pub material_id: Option<MaterialId>,
    pub material_name: Option<String>,
    pub material_slug: Option<String>,
    pub deposit_id: Option<DepositId>,
    pub failure_reason: Option<String>,
    pub expires_at: DateTime<Utc>,
    pub connected_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub weight_grams: Option<i64>,
    pub green_points: Option<i64>,
    pub fractions: Vec<crate::data::deposits::DepositFractionRecord>,
}

#[derive(sqlx::FromRow)]
struct SessionRow {
    id: Uuid,
    user_id: Uuid,
    code: String,
    status: String,
    device_id: Option<Uuid>,
    device_external_id: Option<String>,
    collection_point_id: Option<Uuid>,
    collection_point_name: Option<String>,
    organisation_id: Option<Uuid>,
    material_id: Option<Uuid>,
    material_name: Option<String>,
    material_slug: Option<String>,
    deposit_id: Option<Uuid>,
    failure_reason: Option<String>,
    expires_at: DateTime<Utc>,
    connected_at: Option<DateTime<Utc>>,
    completed_at: Option<DateTime<Utc>>,
    created_at: DateTime<Utc>,
    weight_grams: Option<i64>,
    green_points: Option<i64>,
}

pub struct PgSessionRepo {
    pool: PgPool,
}

impl PgSessionRepo {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn insert(
        &self,
        user_id: UserId,
        code: &str,
        expires_at: DateTime<Utc>,
    ) -> AppResult<SessionRecord> {
        let id = sqlx::query_scalar::<_, Uuid>(
            r#"
            INSERT INTO recycling_sessions (user_id, code, expires_at)
            VALUES ($1, $2, $3)
            RETURNING id
            "#,
        )
        .bind(user_id.as_uuid())
        .bind(code)
        .bind(expires_at)
        .fetch_one(&self.pool)
        .await
        .map_err(|err| {
            if let sqlx::Error::Database(db) = &err
                && db.constraint() == Some("recycling_sessions_open_code")
            {
                return AppError::Conflict("session code collision".into());
            }
            AppError::Internal(err.into())
        })?;
        self.get(RecyclingSessionId::from(id))
            .await?
            .ok_or(AppError::NotFound("session"))
    }

    pub async fn count_recent(&self, user_id: UserId) -> AppResult<i64> {
        sqlx::query_scalar::<_, i64>(
            r#"
            SELECT COUNT(*)
            FROM recycling_sessions
            WHERE user_id = $1 AND created_at > now() - interval '15 minutes'
            "#,
        )
        .bind(user_id.as_uuid())
        .fetch_one(&self.pool)
        .await
        .map_err(|err| AppError::Internal(err.into()))
    }

    pub async fn expire_open_waiting(&self, user_id: UserId) -> AppResult<()> {
        sqlx::query(
            r#"
            UPDATE recycling_sessions
            SET status = 'cancelled', updated_at = now()
            WHERE user_id = $1 AND status = 'waiting_for_machine'
            "#,
        )
        .bind(user_id.as_uuid())
        .execute(&self.pool)
        .await
        .map_err(|err| AppError::Internal(err.into()))?;
        Ok(())
    }

    pub async fn expire_stale(&self) -> AppResult<()> {
        sqlx::query(
            r#"
            UPDATE recycling_sessions
            SET status = 'expired', updated_at = now()
            WHERE status IN ('waiting_for_machine', 'connected', 'sorting', 'measuring')
              AND expires_at < now()
            "#,
        )
        .execute(&self.pool)
        .await
        .map_err(|err| AppError::Internal(err.into()))?;
        Ok(())
    }

    pub async fn get(&self, id: RecyclingSessionId) -> AppResult<Option<SessionRecord>> {
        let row = sqlx::query_as::<_, SessionRow>(sqlx::AssertSqlSafe(session_select("s.id = $1")))
            .bind(id.as_uuid())
            .fetch_optional(&self.pool)
            .await
            .map_err(|err| AppError::Internal(err.into()))?;
        self.from_row(row).await
    }

    async fn from_row(&self, row: Option<SessionRow>) -> AppResult<Option<SessionRecord>> {
        let Some(row) = row else {
            return Ok(None);
        };
        let mut session = into_session(row)?;
        if let Some(deposit_id) = session.deposit_id {
            session.fractions = crate::data::deposits::PgDepositRepo::new(self.pool.clone())
                .list_fractions(deposit_id)
                .await?;
            if session.fractions.is_empty()
                && let (Some(material_id), Some(name), Some(slug), Some(grams), Some(points)) = (
                    session.material_id,
                    session.material_name.clone(),
                    session.material_slug.clone(),
                    session.weight_grams,
                    session.green_points,
                )
            {
                session.fractions.push(
                    crate::data::deposits::DepositFractionRecord {
                        material_id,
                        material_name: name,
                        material_slug: slug,
                        weight_grams: grams,
                        price_per_kg_naira: 0,
                        green_points: points,
                    },
                );
            }
        }
        Ok(Some(session))
    }

    pub async fn get_open_by_code(&self, code: &str) -> AppResult<Option<SessionRecord>> {
        let row = sqlx::query_as::<_, SessionRow>(sqlx::AssertSqlSafe(session_select(
            "s.code = $1 AND s.status IN ('waiting_for_machine', 'connected', 'sorting', 'measuring', 'processing')",
        )))
        .bind(code)
        .fetch_optional(&self.pool)
        .await
        .map_err(|err| AppError::Internal(err.into()))?;
        self.from_row(row).await
    }

    pub async fn latest_by_code(&self, code: &str) -> AppResult<Option<SessionRecord>> {
        let row = sqlx::query_as::<_, SessionRow>(sqlx::AssertSqlSafe(session_select(
            "s.code = $1 ORDER BY s.created_at DESC LIMIT 1",
        )))
        .bind(code)
        .fetch_optional(&self.pool)
        .await
        .map_err(|err| AppError::Internal(err.into()))?;
        self.from_row(row).await
    }

    pub async fn active_for_user(&self, user_id: UserId) -> AppResult<Option<SessionRecord>> {
        let row = sqlx::query_as::<_, SessionRow>(sqlx::AssertSqlSafe(session_select(
            "s.user_id = $1 AND s.status IN ('waiting_for_machine', 'connected', 'sorting', 'measuring', 'processing')
             ORDER BY s.created_at DESC LIMIT 1",
        )))
        .bind(user_id.as_uuid())
        .fetch_optional(&self.pool)
        .await
        .map_err(|err| AppError::Internal(err.into()))?;
        self.from_row(row).await
    }

    pub async fn open_for_device(&self, device_id: DeviceId) -> AppResult<Option<SessionRecord>> {
        let row = sqlx::query_as::<_, SessionRow>(sqlx::AssertSqlSafe(session_select(
            "s.device_id = $1 AND s.status IN ('connected', 'sorting', 'measuring', 'processing')
             ORDER BY s.created_at DESC LIMIT 1",
        )))
        .bind(device_id.as_uuid())
        .fetch_optional(&self.pool)
        .await
        .map_err(|err| AppError::Internal(err.into()))?;
        self.from_row(row).await
    }

    pub async fn claim(
        &self,
        id: RecyclingSessionId,
        device_id: DeviceId,
        collection_point_id: CollectionPointId,
        organisation_id: OrganisationId,
        expires_at: DateTime<Utc>,
    ) -> AppResult<SessionRecord> {
        let updated = sqlx::query(
            r#"
            UPDATE recycling_sessions
            SET status = 'connected',
                device_id = $2,
                collection_point_id = $3,
                organisation_id = $4,
                connected_at = now(),
                expires_at = $5,
                updated_at = now()
            WHERE id = $1 AND status = 'waiting_for_machine'
            "#,
        )
        .bind(id.as_uuid())
        .bind(device_id.as_uuid())
        .bind(collection_point_id.as_uuid())
        .bind(organisation_id.as_uuid())
        .bind(expires_at)
        .execute(&self.pool)
        .await
        .map_err(|err| AppError::Internal(err.into()))?;
        if updated.rows_affected() == 0 {
            return Err(AppError::Conflict("session is no longer waiting".into()));
        }
        self.get(id).await?.ok_or(AppError::NotFound("session"))
    }

    pub async fn set_status(
        &self,
        id: RecyclingSessionId,
        status: RecyclingSessionStatus,
        failure_reason: Option<&str>,
    ) -> AppResult<SessionRecord> {
        sqlx::query(
            r#"
            UPDATE recycling_sessions
            SET status = $2, failure_reason = COALESCE($3, failure_reason), updated_at = now()
            WHERE id = $1
            "#,
        )
        .bind(id.as_uuid())
        .bind(status.as_str())
        .bind(failure_reason)
        .execute(&self.pool)
        .await
        .map_err(|err| AppError::Internal(err.into()))?;
        self.get(id).await?.ok_or(AppError::NotFound("session"))
    }

    pub async fn complete_in_tx(
        tx: &mut Transaction<'_, Postgres>,
        id: RecyclingSessionId,
        material_id: MaterialId,
        deposit_id: DepositId,
    ) -> AppResult<()> {
        sqlx::query(
            r#"
            UPDATE recycling_sessions
            SET status = 'completed',
                material_id = $2,
                deposit_id = $3,
                completed_at = now(),
                updated_at = now()
            WHERE id = $1
            "#,
        )
        .bind(id.as_uuid())
        .bind(material_id.as_uuid())
        .bind(deposit_id.as_uuid())
        .execute(&mut **tx)
        .await
        .map_err(|err| AppError::Internal(err.into()))?;
        Ok(())
    }
}

fn session_select(where_clause: &str) -> String {
    format!(
        r#"
        SELECT s.id, s.user_id, s.code, s.status, s.device_id, d.external_id AS device_external_id,
               s.collection_point_id, cp.name AS collection_point_name, s.organisation_id,
               s.material_id, m.name AS material_name, m.slug::text AS material_slug,
               s.deposit_id, s.failure_reason, s.expires_at, s.connected_at, s.completed_at,
               s.created_at, dep.weight_grams, dep.green_points
        FROM recycling_sessions s
        LEFT JOIN devices d ON d.id = s.device_id
        LEFT JOIN collection_points cp ON cp.id = s.collection_point_id
        LEFT JOIN materials m ON m.id = s.material_id
        LEFT JOIN deposits dep ON dep.id = s.deposit_id
        WHERE {where_clause}
        "#
    )
}

fn into_session(row: SessionRow) -> AppResult<SessionRecord> {
    Ok(SessionRecord {
        id: RecyclingSessionId::from(row.id),
        user_id: UserId::from(row.user_id),
        code: row.code,
        status: RecyclingSessionStatus::parse(&row.status)
            .ok_or_else(|| AppError::Internal(anyhow::anyhow!("invalid session status")))?,
        device_id: row.device_id.map(DeviceId::from),
        device_external_id: row.device_external_id,
        collection_point_id: row.collection_point_id.map(CollectionPointId::from),
        collection_point_name: row.collection_point_name,
        organisation_id: row.organisation_id.map(OrganisationId::from),
        material_id: row.material_id.map(MaterialId::from),
        material_name: row.material_name,
        material_slug: row.material_slug,
        deposit_id: row.deposit_id.map(DepositId::from),
        failure_reason: row.failure_reason,
        expires_at: row.expires_at,
        connected_at: row.connected_at,
        completed_at: row.completed_at,
        created_at: row.created_at,
        weight_grams: row.weight_grams,
        green_points: row.green_points,
        fractions: Vec::new(),
    })
}
