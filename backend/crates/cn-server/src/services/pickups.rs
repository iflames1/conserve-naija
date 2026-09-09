use cn_domain::{PickupId, UserId};

use crate::data::pickups::{PgPickupRepo, PickupRecord};
use crate::error::{AppError, AppResult};
use sqlx::PgPool;

pub struct PickupService {
    pool: PgPool,
}

impl PickupService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn accept(&self, id: PickupId, user_id: UserId) -> AppResult<PickupRecord> {
        PgPickupRepo::new(self.pool.clone())
            .accept(id, user_id)
            .await
    }

    pub async fn complete(
        &self,
        id: PickupId,
        collected_grams: Option<i64>,
    ) -> AppResult<PickupRecord> {
        let repo = PgPickupRepo::new(self.pool.clone());
        let pickup = repo.get(id).await?.ok_or(AppError::NotFound("pickup"))?;
        let collected = collected_grams.unwrap_or(pickup.inventory_grams_at_ready);
        if collected < 0 {
            return Err(AppError::BadRequest("collected weight is invalid".into()));
        }

        let mut tx = self
            .pool
            .begin()
            .await
            .map_err(|err| AppError::Internal(err.into()))?;
        PgPickupRepo::complete_in_tx(
            &mut tx,
            id,
            collected,
            pickup.collection_point_id,
            pickup.material_id,
        )
        .await?;
        tx.commit()
            .await
            .map_err(|err| AppError::Internal(err.into()))?;
        repo.get(id).await?.ok_or(AppError::NotFound("pickup"))
    }

    pub async fn cancel(&self, id: PickupId) -> AppResult<PickupRecord> {
        PgPickupRepo::new(self.pool.clone()).cancel(id).await
    }
}
