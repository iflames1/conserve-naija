use chrono::{DateTime, Utc};
use cn_domain::{CollectionPointId, DeviceId, MaterialId, OrganisationId};
use sqlx::PgPool;
use uuid::Uuid;

use crate::error::{AppError, AppResult};

#[derive(Debug, Clone)]
pub struct DeviceRecord {
    pub id: DeviceId,
    pub organisation_id: OrganisationId,
    pub collection_point_id: Option<CollectionPointId>,
    pub collection_point_name: Option<String>,
    pub external_id: String,
    pub device_type: String,
    pub status: String,
    pub firmware_version: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub last_seen_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone)]
pub struct BinState {
    pub material_id: MaterialId,
    pub material_slug: String,
    pub material_name: String,
    pub weight_grams: i64,
    pub fill_percent: Option<i32>,
    pub updated_at: DateTime<Utc>,
}

#[derive(sqlx::FromRow)]
struct DeviceRow {
    id: Uuid,
    organisation_id: Uuid,
    collection_point_id: Option<Uuid>,
    collection_point_name: Option<String>,
    external_id: String,
    device_type: String,
    status: String,
    firmware_version: Option<String>,
    latitude: Option<f64>,
    longitude: Option<f64>,
    last_seen_at: Option<DateTime<Utc>>,
}

pub struct PgDeviceRepo {
    pool: PgPool,
}

impl PgDeviceRepo {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn get_by_api_key_hash(&self, hash: &str) -> AppResult<Option<DeviceRecord>> {
        let row = sqlx::query_as::<_, DeviceRow>(sqlx::AssertSqlSafe(device_select("d.api_key_hash = $1")))
            .bind(hash)
            .fetch_optional(&self.pool)
            .await
            .map_err(|err| AppError::Internal(err.into()))?;
        Ok(row.map(into_device))
    }

    pub async fn get(&self, id: DeviceId) -> AppResult<Option<DeviceRecord>> {
        let row = sqlx::query_as::<_, DeviceRow>(sqlx::AssertSqlSafe(device_select("d.id = $1")))
            .bind(id.as_uuid())
            .fetch_optional(&self.pool)
            .await
            .map_err(|err| AppError::Internal(err.into()))?;
        Ok(row.map(into_device))
    }

    pub async fn list_for_org(&self, organisation_id: OrganisationId) -> AppResult<Vec<DeviceRecord>> {
        let rows = sqlx::query_as::<_, DeviceRow>(sqlx::AssertSqlSafe(device_select(
            "d.organisation_id = $1 ORDER BY d.external_id",
        )))
        .bind(organisation_id.as_uuid())
        .fetch_all(&self.pool)
        .await
        .map_err(|err| AppError::Internal(err.into()))?;
        Ok(rows.into_iter().map(into_device).collect())
    }

    pub async fn device_for_collection_point(
        &self,
        collection_point_id: CollectionPointId,
    ) -> AppResult<Option<DeviceRecord>> {
        let row = sqlx::query_as::<_, DeviceRow>(sqlx::AssertSqlSafe(device_select(
            "d.collection_point_id = $1 AND d.status = 'active' ORDER BY d.created_at LIMIT 1",
        )))
        .bind(collection_point_id.as_uuid())
        .fetch_optional(&self.pool)
        .await
        .map_err(|err| AppError::Internal(err.into()))?;
        Ok(row.map(into_device))
    }

    pub async fn register(
        &self,
        organisation_id: OrganisationId,
        external_id: &str,
        device_type: &str,
        api_key_hash: &str,
        firmware_version: Option<&str>,
    ) -> AppResult<DeviceRecord> {
        let id: Uuid = sqlx::query_scalar(
            r#"
            INSERT INTO devices (
                organisation_id, external_id, device_type, api_key_hash, firmware_version
            )
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id
            "#,
        )
        .bind(organisation_id.as_uuid())
        .bind(external_id)
        .bind(device_type)
        .bind(api_key_hash)
        .bind(firmware_version)
        .fetch_one(&self.pool)
        .await
        .map_err(|err| {
            if let sqlx::Error::Database(db) = &err
                && db.constraint() == Some("devices_organisation_id_external_id_key")
            {
                return AppError::Conflict("device id already registered".into());
            }
            AppError::Internal(err.into())
        })?;
        self.get(DeviceId::from(id))
            .await?
            .ok_or_else(|| AppError::Internal(anyhow::anyhow!("device missing after insert")))
    }

    pub async fn set_status(&self, device_id: DeviceId, status: &str) -> AppResult<DeviceRecord> {
        let updated = sqlx::query(
            r#"
            UPDATE devices
            SET status = $2
            WHERE id = $1
            "#,
        )
        .bind(device_id.as_uuid())
        .bind(status)
        .execute(&self.pool)
        .await
        .map_err(|err| AppError::Internal(err.into()))?;
        if updated.rows_affected() == 0 {
            return Err(AppError::NotFound("device"));
        }
        self.get(device_id).await?.ok_or(AppError::NotFound("device"))
    }

    pub async fn associate(
        &self,
        device_id: DeviceId,
        collection_point_id: CollectionPointId,
    ) -> AppResult<()> {
        let updated = sqlx::query(
            r#"
            UPDATE devices
            SET collection_point_id = $2
            WHERE id = $1
            "#,
        )
        .bind(device_id.as_uuid())
        .bind(collection_point_id.as_uuid())
        .execute(&self.pool)
        .await
        .map_err(|err| AppError::Internal(err.into()))?;
        if updated.rows_affected() == 0 {
            return Err(AppError::NotFound("device"));
        }
        Ok(())
    }

    pub async fn touch_heartbeat(
        &self,
        device_id: DeviceId,
        latitude: Option<f64>,
        longitude: Option<f64>,
        firmware_version: Option<&str>,
    ) -> AppResult<()> {
        sqlx::query(
            r#"
            UPDATE devices
            SET last_seen_at = now(),
                latitude = COALESCE($2, latitude),
                longitude = COALESCE($3, longitude),
                firmware_version = COALESCE($4, firmware_version)
            WHERE id = $1
            "#,
        )
        .bind(device_id.as_uuid())
        .bind(latitude)
        .bind(longitude)
        .bind(firmware_version)
        .execute(&self.pool)
        .await
        .map_err(|err| AppError::Internal(err.into()))?;
        Ok(())
    }

    pub async fn insert_telemetry(
        &self,
        device_id: DeviceId,
        latitude: Option<f64>,
        longitude: Option<f64>,
        payload: &serde_json::Value,
    ) -> AppResult<Uuid> {
        let id = sqlx::query_scalar::<_, Uuid>(
            r#"
            INSERT INTO device_telemetry (device_id, latitude, longitude, payload)
            VALUES ($1, $2, $3, $4)
            RETURNING id
            "#,
        )
        .bind(device_id.as_uuid())
        .bind(latitude)
        .bind(longitude)
        .bind(payload)
        .fetch_one(&self.pool)
        .await
        .map_err(|err| AppError::Internal(err.into()))?;
        Ok(id)
    }

    pub async fn upsert_bin_state(
        &self,
        device_id: DeviceId,
        material_id: MaterialId,
        weight_grams: i64,
        fill_percent: Option<i32>,
    ) -> AppResult<()> {
        sqlx::query(
            r#"
            INSERT INTO device_bin_state (device_id, material_id, weight_grams, fill_percent)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (device_id, material_id) DO UPDATE SET
                weight_grams = EXCLUDED.weight_grams,
                fill_percent = EXCLUDED.fill_percent,
                updated_at = now()
            "#,
        )
        .bind(device_id.as_uuid())
        .bind(material_id.as_uuid())
        .bind(weight_grams)
        .bind(fill_percent)
        .execute(&self.pool)
        .await
        .map_err(|err| AppError::Internal(err.into()))?;
        Ok(())
    }

    pub async fn latest_bins(&self, device_id: DeviceId) -> AppResult<Vec<BinState>> {
        let rows = sqlx::query_as::<_, (Uuid, String, String, i64, Option<i32>, DateTime<Utc>)>(
            r#"
            SELECT b.material_id, m.slug::text, m.name, b.weight_grams, b.fill_percent, b.updated_at
            FROM device_bin_state b
            JOIN materials m ON m.id = b.material_id
            WHERE b.device_id = $1
            ORDER BY m.name
            "#,
        )
        .bind(device_id.as_uuid())
        .fetch_all(&self.pool)
        .await
        .map_err(|err| AppError::Internal(err.into()))?;
        Ok(rows
            .into_iter()
            .map(
                |(material_id, material_slug, material_name, weight_grams, fill_percent, updated_at)| {
                    BinState {
                        material_id: MaterialId::from(material_id),
                        material_slug,
                        material_name,
                        weight_grams,
                        fill_percent,
                        updated_at,
                    }
                },
            )
            .collect())
    }
}

fn device_select(where_clause: &str) -> String {
    format!(
        r#"
        SELECT d.id, d.organisation_id, d.collection_point_id, cp.name AS collection_point_name,
               d.external_id, d.device_type, d.status, d.firmware_version,
               d.latitude, d.longitude, d.last_seen_at
        FROM devices d
        LEFT JOIN collection_points cp ON cp.id = d.collection_point_id
        WHERE {where_clause}
        "#
    )
}

fn into_device(row: DeviceRow) -> DeviceRecord {
    DeviceRecord {
        id: DeviceId::from(row.id),
        organisation_id: OrganisationId::from(row.organisation_id),
        collection_point_id: row.collection_point_id.map(CollectionPointId::from),
        collection_point_name: row.collection_point_name,
        external_id: row.external_id,
        device_type: row.device_type,
        status: row.status,
        firmware_version: row.firmware_version,
        latitude: row.latitude,
        longitude: row.longitude,
        last_seen_at: row.last_seen_at,
    }
}
