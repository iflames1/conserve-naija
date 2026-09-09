use cn_domain::{
    DepositId, DepositStatus, DeviceId, MaterialId, UserId, grams_from_kg, green_points_for_deposit,
};
use sqlx::PgPool;
use uuid::Uuid;

use crate::data::collection_points::PgCollectionPointRepo;
use crate::data::deposits::{DepositRecord, PgDepositRepo};
use crate::data::devices::PgDeviceRepo;
use crate::data::materials::PgMaterialRepo;
use crate::data::pickups::PgPickupRepo;
use crate::error::{AppError, AppResult};

pub struct DepositService {
    pool: PgPool,
}

impl DepositService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn start(
        &self,
        user_id: UserId,
        collection_point_id: Uuid,
        material_id: Uuid,
        idempotency_key: &str,
    ) -> AppResult<DepositRecord> {
        let key = idempotency_key.trim();
        if key.is_empty() || key.len() > 80 {
            return Err(AppError::BadRequest(
                "idempotency key must be 1–80 characters".into(),
            ));
        }

        let points = PgCollectionPointRepo::new(self.pool.clone());
        let point = points
            .get(collection_point_id.into())
            .await?
            .ok_or(AppError::NotFound("collection point"))?;
        if !point.status.accepts_deposits() {
            return Err(AppError::BadRequest(
                "this collection point is not accepting deposits".into(),
            ));
        }

        let materials = PgMaterialRepo::new(self.pool.clone());
        let material = materials
            .get(MaterialId::from(material_id))
            .await?
            .ok_or(AppError::NotFound("material"))?;
        if !material.active {
            return Err(AppError::BadRequest("material is not active".into()));
        }
        if !points
            .supports_material(point.id, material.id)
            .await?
        {
            return Err(AppError::BadRequest(
                "this collection point does not accept that material".into(),
            ));
        }

        let device = PgDeviceRepo::new(self.pool.clone())
            .device_for_collection_point(point.id)
            .await?;

        PgDepositRepo::new(self.pool.clone())
            .insert(
                user_id,
                point.id,
                point.organisation_id,
                material.id,
                device.map(|d| d.id),
                key,
            )
            .await
    }

    pub async fn apply_device_measurement(
        &self,
        device_id: DeviceId,
        deposit_id: DepositId,
        weight_kg: f64,
    ) -> AppResult<DepositRecord> {
        let weight_grams = grams_from_kg(weight_kg)
            .map_err(|err| AppError::BadRequest(err.to_string()))?;
        let repo = PgDepositRepo::new(self.pool.clone());
        let deposit = repo
            .get(deposit_id)
            .await?
            .ok_or(AppError::NotFound("deposit"))?;
        if deposit.status == DepositStatus::Confirmed {
            return Err(AppError::Conflict("deposit is already confirmed".into()));
        }
        if deposit.status == DepositStatus::Cancelled {
            return Err(AppError::Conflict("deposit was cancelled".into()));
        }
        if let Some(assigned) = deposit.device_id
            && assigned != device_id
        {
            return Err(AppError::Forbidden("device does not own this deposit"));
        }
        let device = PgDeviceRepo::new(self.pool.clone())
            .get(device_id)
            .await?
            .ok_or(AppError::NotFound("device"))?;
        if device.collection_point_id != Some(deposit.collection_point_id) {
            return Err(AppError::Forbidden(
                "device is not bound to this collection point",
            ));
        }
        if deposit.status == DepositStatus::Measured
            && deposit.weight_grams == Some(weight_grams)
        {
            return Ok(deposit);
        }
        repo.apply_measurement(deposit_id, weight_grams, device_id)
            .await
    }

    pub async fn confirm(&self, user_id: UserId, deposit_id: DepositId) -> AppResult<DepositRecord> {
        let repo = PgDepositRepo::new(self.pool.clone());
        let deposit = repo
            .get(deposit_id)
            .await?
            .ok_or(AppError::NotFound("deposit"))?;
        if deposit.user_id != user_id {
            return Err(AppError::Forbidden("not your deposit"));
        }
        if deposit.status == DepositStatus::Confirmed {
            return Ok(deposit);
        }
        if deposit.status != DepositStatus::Measured {
            return Err(AppError::BadRequest(
                "the collection point has not finished measuring yet".into(),
            ));
        }
        let weight_grams = deposit
            .weight_grams
            .ok_or_else(|| AppError::BadRequest("measurement is missing".into()))?;

        let price = PgMaterialRepo::new(self.pool.clone())
            .current_price(deposit.organisation_id, deposit.material_id)
            .await?
            .ok_or_else(|| {
                AppError::BadRequest("no price is configured for this material".into())
            })?;
        let green_points = green_points_for_deposit(weight_grams, price.price_per_kg_naira)
            .map_err(|err| AppError::BadRequest(err.to_string()))?;

        let mut tx = self
            .pool
            .begin()
            .await
            .map_err(|err| AppError::Internal(err.into()))?;

        let applied = PgDepositRepo::confirm_in_tx(
            &mut tx,
            deposit.id,
            deposit.user_id,
            deposit.collection_point_id,
            deposit.material_id,
            weight_grams,
            price.price_per_kg_naira,
            green_points,
        )
        .await?;
        if !applied {
            tx.commit()
                .await
                .map_err(|err| AppError::Internal(err.into()))?;
            return repo
                .get(deposit_id)
                .await?
                .ok_or(AppError::NotFound("deposit"));
        }

        let threshold = sqlx::query_as::<_, (i64, i64)>(
            r#"
            SELECT i.weight_grams,
                   COALESCE(cpm.pickup_threshold_grams, cp.default_pickup_threshold_grams)
            FROM collection_point_inventory i
            JOIN collection_points cp ON cp.id = i.collection_point_id
            LEFT JOIN collection_point_materials cpm
                ON cpm.collection_point_id = i.collection_point_id
               AND cpm.material_id = i.material_id
            WHERE i.collection_point_id = $1 AND i.material_id = $2
            "#,
        )
        .bind(deposit.collection_point_id.as_uuid())
        .bind(deposit.material_id.as_uuid())
        .fetch_optional(&mut *tx)
        .await
        .map_err(|err| AppError::Internal(err.into()))?;

        if let Some((inventory_grams, threshold_grams)) = threshold {
            PgPickupRepo::ensure_ready_in_tx(
                &mut tx,
                deposit.organisation_id,
                deposit.collection_point_id,
                deposit.material_id,
                threshold_grams,
                inventory_grams,
            )
            .await?;
        }

        tx.commit()
            .await
            .map_err(|err| AppError::Internal(err.into()))?;

        repo.get(deposit_id)
            .await?
            .ok_or(AppError::NotFound("deposit"))
    }
}
