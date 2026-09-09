use chrono::{DateTime, Utc};
use cn_domain::{
    CollectionPointId, DepositId, DepositStatus, DeviceId, MaterialId, OrganisationId,
    RecyclingSessionId, UserId,
};
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

use crate::error::{AppError, AppResult};

#[derive(Debug, Clone)]
pub struct DepositRecord {
    pub id: DepositId,
    pub user_id: UserId,
    pub collection_point_id: CollectionPointId,
    pub collection_point_name: String,
    pub organisation_id: OrganisationId,
    pub material_id: MaterialId,
    pub material_name: String,
    pub material_slug: String,
    pub device_id: Option<DeviceId>,
    pub status: DepositStatus,
    pub weight_grams: Option<i64>,
    pub price_per_kg_naira: Option<i64>,
    pub green_points: Option<i64>,
    pub idempotency_key: String,
    pub created_at: DateTime<Utc>,
    pub measured_at: Option<DateTime<Utc>>,
    pub confirmed_at: Option<DateTime<Utc>>,
}

#[derive(sqlx::FromRow)]
struct DepositRow {
    id: Uuid,
    user_id: Uuid,
    collection_point_id: Uuid,
    collection_point_name: String,
    organisation_id: Uuid,
    material_id: Uuid,
    material_name: String,
    material_slug: String,
    device_id: Option<Uuid>,
    status: String,
    weight_grams: Option<i64>,
    price_per_kg_naira: Option<i64>,
    green_points: Option<i64>,
    idempotency_key: String,
    created_at: DateTime<Utc>,
    measured_at: Option<DateTime<Utc>>,
    confirmed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone)]
pub struct LedgerEntry {
    pub id: Uuid,
    pub user_id: UserId,
    pub amount: i64,
    pub entry_type: String,
    pub reference_type: Option<String>,
    pub reference_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

pub struct PgDepositRepo {
    pool: PgPool,
}

impl PgDepositRepo {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn insert(
        &self,
        user_id: UserId,
        collection_point_id: CollectionPointId,
        organisation_id: OrganisationId,
        material_id: MaterialId,
        device_id: Option<DeviceId>,
        idempotency_key: &str,
    ) -> AppResult<DepositRecord> {
        let result = sqlx::query_scalar::<_, Uuid>(
            r#"
            INSERT INTO deposits (
                user_id, collection_point_id, organisation_id, material_id,
                device_id, idempotency_key
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (idempotency_key) DO NOTHING
            RETURNING id
            "#,
        )
        .bind(user_id.as_uuid())
        .bind(collection_point_id.as_uuid())
        .bind(organisation_id.as_uuid())
        .bind(material_id.as_uuid())
        .bind(device_id.map(|id| id.as_uuid()))
        .bind(idempotency_key)
        .fetch_optional(&self.pool)
        .await
        .map_err(|err| AppError::Internal(err.into()))?;

        let id = if let Some(id) = result {
            id
        } else {
            let existing = self
                .get_by_idempotency(idempotency_key)
                .await?
                .ok_or_else(|| AppError::Internal(anyhow::anyhow!("idempotent deposit missing")))?;
            if existing.user_id != user_id
                || existing.collection_point_id != collection_point_id
                || existing.material_id != material_id
            {
                return Err(AppError::Conflict(
                    "idempotency key already used for a different deposit".into(),
                ));
            }
            return Ok(existing);
        };

        self.get(DepositId::from(id))
            .await?
            .ok_or_else(|| AppError::Internal(anyhow::anyhow!("deposit missing after insert")))
    }

    pub async fn get(&self, id: DepositId) -> AppResult<Option<DepositRecord>> {
        let row = sqlx::query_as::<_, DepositRow>(sqlx::AssertSqlSafe(deposit_select("d.id = $1")))
            .bind(id.as_uuid())
            .fetch_optional(&self.pool)
            .await
            .map_err(|err| AppError::Internal(err.into()))?;
        row.map(into_deposit).transpose()
    }

    pub async fn get_by_session(
        &self,
        session_id: RecyclingSessionId,
    ) -> AppResult<Option<DepositRecord>> {
        let row = sqlx::query_as::<_, DepositRow>(sqlx::AssertSqlSafe(deposit_select(
            "d.session_id = $1",
        )))
        .bind(session_id.as_uuid())
        .fetch_optional(&self.pool)
        .await
        .map_err(|err| AppError::Internal(err.into()))?;
        row.map(into_deposit).transpose()
    }

    pub async fn get_by_idempotency(&self, key: &str) -> AppResult<Option<DepositRecord>> {
        let row = sqlx::query_as::<_, DepositRow>(sqlx::AssertSqlSafe(deposit_select("d.idempotency_key = $1")))
            .bind(key)
            .fetch_optional(&self.pool)
            .await
            .map_err(|err| AppError::Internal(err.into()))?;
        row.map(into_deposit).transpose()
    }

    pub async fn list_for_user(
        &self,
        user_id: UserId,
        limit: i64,
        offset: i64,
    ) -> AppResult<Vec<DepositRecord>> {
        let rows = sqlx::query_as::<_, DepositRow>(sqlx::AssertSqlSafe(deposit_select(
            "d.user_id = $1 ORDER BY d.created_at DESC LIMIT $2 OFFSET $3",
        )))
        .bind(user_id.as_uuid())
        .bind(limit)
        .bind(offset)
        .fetch_all(&self.pool)
        .await
        .map_err(|err| AppError::Internal(err.into()))?;
        rows.into_iter().map(into_deposit).collect()
    }

    pub async fn list_for_org(
        &self,
        organisation_id: OrganisationId,
        limit: i64,
    ) -> AppResult<Vec<DepositRecord>> {
        let rows = sqlx::query_as::<_, DepositRow>(sqlx::AssertSqlSafe(deposit_select(
            "d.organisation_id = $1 ORDER BY d.created_at DESC LIMIT $2",
        )))
        .bind(organisation_id.as_uuid())
        .bind(limit)
        .fetch_all(&self.pool)
        .await
        .map_err(|err| AppError::Internal(err.into()))?;
        rows.into_iter().map(into_deposit).collect()
    }

    pub async fn pending_for_device(&self, device_id: DeviceId) -> AppResult<Vec<DepositRecord>> {
        let rows = sqlx::query_as::<_, DepositRow>(sqlx::AssertSqlSafe(deposit_select(
            "d.device_id = $1 AND d.status = 'pending_measurement' ORDER BY d.created_at",
        )))
        .bind(device_id.as_uuid())
        .fetch_all(&self.pool)
        .await
        .map_err(|err| AppError::Internal(err.into()))?;
        rows.into_iter().map(into_deposit).collect()
    }

    pub async fn apply_measurement(
        &self,
        deposit_id: DepositId,
        weight_grams: i64,
        device_id: DeviceId,
    ) -> AppResult<DepositRecord> {
        let updated = sqlx::query(
            r#"
            UPDATE deposits
            SET status = 'measured',
                weight_grams = $2,
                device_id = $3,
                measured_at = now()
            WHERE id = $1
              AND status IN ('pending_measurement', 'measured')
            "#,
        )
        .bind(deposit_id.as_uuid())
        .bind(weight_grams)
        .bind(device_id.as_uuid())
        .execute(&self.pool)
        .await
        .map_err(|err| AppError::Internal(err.into()))?;
        if updated.rows_affected() == 0 {
            return Err(AppError::Conflict("deposit cannot accept a measurement".into()));
        }
        self.get(deposit_id)
            .await?
            .ok_or(AppError::NotFound("deposit"))
    }

    pub async fn list_transactions(
        &self,
        user_id: UserId,
        limit: i64,
        offset: i64,
    ) -> AppResult<Vec<LedgerEntry>> {
        let rows = sqlx::query_as::<_, (Uuid, Uuid, i64, String, Option<String>, Option<Uuid>, DateTime<Utc>)>(
            r#"
            SELECT id, user_id, amount, entry_type, reference_type, reference_id, created_at
            FROM green_point_transactions
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT $2 OFFSET $3
            "#,
        )
        .bind(user_id.as_uuid())
        .bind(limit)
        .bind(offset)
        .fetch_all(&self.pool)
        .await
        .map_err(|err| AppError::Internal(err.into()))?;
        Ok(rows
            .into_iter()
            .map(
                |(id, user_id, amount, entry_type, reference_type, reference_id, created_at)| {
                    LedgerEntry {
                        id,
                        user_id: UserId::from(user_id),
                        amount,
                        entry_type,
                        reference_type,
                        reference_id,
                        created_at,
                    }
                },
            )
            .collect())
    }

    pub async fn insert_confirmed_in_tx(
        tx: &mut Transaction<'_, Postgres>,
        user_id: UserId,
        collection_point_id: CollectionPointId,
        organisation_id: OrganisationId,
        material_id: MaterialId,
        device_id: DeviceId,
        session_id: RecyclingSessionId,
        weight_grams: i64,
        price_per_kg_naira: i64,
        green_points: i64,
        idempotency_key: &str,
    ) -> AppResult<DepositId> {
        let result = sqlx::query_scalar::<_, Uuid>(
            r#"
            INSERT INTO deposits (
                user_id, collection_point_id, organisation_id, material_id, device_id,
                session_id, status, weight_grams, price_per_kg_naira, green_points,
                idempotency_key, measured_at, confirmed_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, 'confirmed', $7, $8, $9, $10, now(), now())
            ON CONFLICT (idempotency_key) DO NOTHING
            RETURNING id
            "#,
        )
        .bind(user_id.as_uuid())
        .bind(collection_point_id.as_uuid())
        .bind(organisation_id.as_uuid())
        .bind(material_id.as_uuid())
        .bind(device_id.as_uuid())
        .bind(session_id.as_uuid())
        .bind(weight_grams)
        .bind(price_per_kg_naira)
        .bind(green_points)
        .bind(idempotency_key)
        .fetch_optional(&mut **tx)
        .await
        .map_err(|err| AppError::Internal(err.into()))?;

        let deposit_id = match result {
            Some(id) => DepositId::from(id),
            None => {
                let existing = sqlx::query_scalar::<_, Uuid>(
                    "SELECT id FROM deposits WHERE idempotency_key = $1",
                )
                .bind(idempotency_key)
                .fetch_one(&mut **tx)
                .await
                .map_err(|err| AppError::Internal(err.into()))?;
                return Ok(DepositId::from(existing));
            }
        };

        credit_reward_in_tx(tx, user_id, collection_point_id, material_id, weight_grams, green_points, deposit_id)
            .await?;
        Ok(deposit_id)
    }

    pub async fn confirm_in_tx(
        tx: &mut Transaction<'_, Postgres>,
        deposit_id: DepositId,
        user_id: UserId,
        collection_point_id: CollectionPointId,
        material_id: MaterialId,
        weight_grams: i64,
        price_per_kg_naira: i64,
        green_points: i64,
    ) -> AppResult<bool> {
        let applied = sqlx::query(
            r#"
            UPDATE deposits
            SET status = 'confirmed',
                price_per_kg_naira = $2,
                green_points = $3,
                confirmed_at = now()
            WHERE id = $1 AND status = 'measured'
            "#,
        )
        .bind(deposit_id.as_uuid())
        .bind(price_per_kg_naira)
        .bind(green_points)
        .execute(&mut **tx)
        .await
        .map_err(|err| AppError::Internal(err.into()))?;
        if applied.rows_affected() == 0 {
            return Ok(false);
        }

        credit_reward_in_tx(
            tx,
            user_id,
            collection_point_id,
            material_id,
            weight_grams,
            green_points,
            deposit_id,
        )
        .await?;
        Ok(true)
    }
}

async fn credit_reward_in_tx(
    tx: &mut Transaction<'_, Postgres>,
    user_id: UserId,
    collection_point_id: CollectionPointId,
    material_id: MaterialId,
    weight_grams: i64,
    green_points: i64,
    deposit_id: DepositId,
) -> AppResult<()> {
    let inserted = sqlx::query(
        r#"
        INSERT INTO green_point_transactions (
            user_id, amount, entry_type, reference_type, reference_id
        )
        VALUES ($1, $2, 'deposit_reward', 'deposit', $3)
        ON CONFLICT (reference_id) WHERE entry_type = 'deposit_reward' AND reference_id IS NOT NULL
        DO NOTHING
        "#,
    )
    .bind(user_id.as_uuid())
    .bind(green_points)
    .bind(deposit_id.as_uuid())
    .execute(&mut **tx)
    .await
    .map_err(|err| AppError::Internal(err.into()))?;

    if inserted.rows_affected() == 0 {
        return Ok(());
    }

    sqlx::query(
        r#"
        UPDATE users
        SET green_points_balance = green_points_balance + $2, updated_at = now()
        WHERE id = $1
        "#,
    )
    .bind(user_id.as_uuid())
    .bind(green_points)
    .execute(&mut **tx)
    .await
    .map_err(|err| AppError::Internal(err.into()))?;

    sqlx::query(
        r#"
        INSERT INTO collection_point_inventory (collection_point_id, material_id, weight_grams)
        VALUES ($1, $2, $3)
        ON CONFLICT (collection_point_id, material_id) DO UPDATE SET
            weight_grams = collection_point_inventory.weight_grams + EXCLUDED.weight_grams,
            updated_at = now()
        "#,
    )
    .bind(collection_point_id.as_uuid())
    .bind(material_id.as_uuid())
    .bind(weight_grams)
    .execute(&mut **tx)
    .await
    .map_err(|err| AppError::Internal(err.into()))?;

    Ok(())
}

fn deposit_select(where_clause: &str) -> String {
    format!(
        r#"
        SELECT d.id, d.user_id, d.collection_point_id, cp.name AS collection_point_name,
               d.organisation_id, d.material_id, m.name AS material_name, m.slug::text AS material_slug,
               d.device_id, d.status, d.weight_grams, d.price_per_kg_naira, d.green_points,
               d.idempotency_key, d.created_at, d.measured_at, d.confirmed_at
        FROM deposits d
        JOIN collection_points cp ON cp.id = d.collection_point_id
        JOIN materials m ON m.id = d.material_id
        WHERE {where_clause}
        "#
    )
}

fn into_deposit(row: DepositRow) -> AppResult<DepositRecord> {
    Ok(DepositRecord {
        id: DepositId::from(row.id),
        user_id: UserId::from(row.user_id),
        collection_point_id: CollectionPointId::from(row.collection_point_id),
        collection_point_name: row.collection_point_name,
        organisation_id: OrganisationId::from(row.organisation_id),
        material_id: MaterialId::from(row.material_id),
        material_name: row.material_name,
        material_slug: row.material_slug,
        device_id: row.device_id.map(DeviceId::from),
        status: DepositStatus::parse(&row.status)
            .ok_or_else(|| AppError::Internal(anyhow::anyhow!("invalid deposit status")))?,
        weight_grams: row.weight_grams,
        price_per_kg_naira: row.price_per_kg_naira,
        green_points: row.green_points,
        idempotency_key: row.idempotency_key,
        created_at: row.created_at,
        measured_at: row.measured_at,
        confirmed_at: row.confirmed_at,
    })
}
