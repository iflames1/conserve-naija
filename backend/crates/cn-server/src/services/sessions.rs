use chrono::{Duration, Utc};
use cn_domain::{
    RecyclingSessionId, RecyclingSessionStatus, UserId, grams_from_kg, green_points_for_deposit,
    kg_from_grams,
};
use rand::Rng;
use sqlx::PgPool;

use crate::data::collection_points::PgCollectionPointRepo;
use crate::data::deposits::PgDepositRepo;
use crate::data::devices::DeviceRecord;
use crate::data::materials::PgMaterialRepo;
use crate::data::pickups::PgPickupRepo;
use crate::data::sessions::{PgSessionRepo, SessionRecord};
use crate::data::users::PgUserRepo;
use crate::error::{AppError, AppResult};
use crate::services::realtime::RealtimeHub;

const WAITING_TTL_SECS: i64 = 120;
const CONNECTED_TTL_SECS: i64 = 600;
const MAX_STARTS_PER_WINDOW: i64 = 8;
const MAX_CODE_ATTEMPTS: usize = 12;

pub struct SessionService {
    pool: PgPool,
    hub: RealtimeHub,
}

impl SessionService {
    pub fn new(pool: PgPool, hub: RealtimeHub) -> Self {
        Self { pool, hub }
    }

    pub fn repo(&self) -> PgSessionRepo {
        PgSessionRepo::new(self.pool.clone())
    }

    pub async fn start(&self, user_id: UserId) -> AppResult<SessionRecord> {
        let repo = self.repo();
        repo.expire_stale().await?;

        let recent = repo.count_recent(user_id).await?;
        if recent >= MAX_STARTS_PER_WINDOW {
            return Err(AppError::BadRequest(
                "too many recycling missions. wait a few minutes and try again".into(),
            ));
        }

        if let Some(active) = repo.active_for_user(user_id).await? {
            if active.status != RecyclingSessionStatus::WaitingForMachine {
                return Err(AppError::Conflict(
                    "you already have a live recycling mission".into(),
                ));
            }
        }
        repo.expire_open_waiting(user_id).await?;

        let expires_at = Utc::now() + Duration::seconds(WAITING_TTL_SECS);
        let mut last_err = AppError::Internal(anyhow::anyhow!("could not allocate a session code"));
        for _ in 0..MAX_CODE_ATTEMPTS {
            let code = random_code();
            match repo.insert(user_id, &code, expires_at).await {
                Ok(session) => {
                    self.publish(&session).await;
                    return Ok(session);
                }
                Err(AppError::Conflict(_)) => {
                    last_err = AppError::Conflict("session code collision".into());
                    continue;
                }
                Err(err) => return Err(err),
            }
        }
        Err(last_err)
    }

    pub async fn get_for_user(
        &self,
        user_id: UserId,
        id: RecyclingSessionId,
    ) -> AppResult<SessionRecord> {
        self.repo().expire_stale().await?;
        let session = self
            .repo()
            .get(id)
            .await?
            .ok_or(AppError::NotFound("session"))?;
        if session.user_id != user_id {
            return Err(AppError::Forbidden("not your session"));
        }
        Ok(session)
    }

    pub async fn active_for_user(&self, user_id: UserId) -> AppResult<Option<SessionRecord>> {
        self.repo().expire_stale().await?;
        self.repo().active_for_user(user_id).await
    }

    pub async fn cancel(&self, user_id: UserId, id: RecyclingSessionId) -> AppResult<SessionRecord> {
        let session = self.get_for_user(user_id, id).await?;
        if !session.status.is_open() {
            return Ok(session);
        }
        if session.status == RecyclingSessionStatus::Processing {
            return Err(AppError::Conflict(
                "this mission is already being processed".into(),
            ));
        }
        let updated = self
            .repo()
            .set_status(id, RecyclingSessionStatus::Cancelled, None)
            .await?;
        self.publish(&updated).await;
        Ok(updated)
    }

    pub async fn claim(&self, device: &DeviceRecord, raw_code: &str) -> AppResult<SessionRecord> {
        let repo = self.repo();
        repo.expire_stale().await?;

        let collection_point_id = device
            .collection_point_id
            .ok_or_else(|| AppError::BadRequest("machine is not assigned to a collection point".into()))?;
        if device.status != "active" {
            return Err(AppError::Forbidden("machine is not active"));
        }

        if let Some(busy) = repo.open_for_device(device.id).await? {
            return Err(AppError::Conflict(format!(
                "this machine is already serving session {}",
                busy.code
            )));
        }

        let code = normalize_code(raw_code)?;
        let Some(session) = repo.get_open_by_code(&code).await? else {
            if let Some(closed) = repo.latest_by_code(&code).await? {
                return Err(match closed.status {
                    RecyclingSessionStatus::Expired => {
                        AppError::BadRequest("session expired".into())
                    }
                    RecyclingSessionStatus::Completed => {
                        AppError::Conflict("session already used".into())
                    }
                    RecyclingSessionStatus::Cancelled => {
                        AppError::Conflict("session was cancelled".into())
                    }
                    _ => AppError::BadRequest("invalid session".into()),
                });
            }
            return Err(AppError::BadRequest("invalid session".into()));
        };

        if session.expires_at <= Utc::now() {
            let expired = repo
                .set_status(session.id, RecyclingSessionStatus::Expired, None)
                .await?;
            self.publish(&expired).await;
            return Err(AppError::BadRequest("session expired".into()));
        }
        if !session.status.is_claimable() {
            return Err(AppError::Conflict("session already used".into()));
        }

        let claimed = repo
            .claim(
                session.id,
                device.id,
                collection_point_id,
                device.organisation_id,
                Utc::now() + Duration::seconds(CONNECTED_TTL_SECS),
            )
            .await?;
        self.publish(&claimed).await;
        Ok(claimed)
    }

    pub async fn measure(
        &self,
        device: &DeviceRecord,
        session_id: RecyclingSessionId,
        material_slug: &str,
        weight_kg: f64,
    ) -> AppResult<SessionRecord> {
        let repo = self.repo();
        repo.expire_stale().await?;

        let mut session = repo
            .get(session_id)
            .await?
            .ok_or(AppError::NotFound("session"))?;
        if session.device_id != Some(device.id) {
            return Err(AppError::Forbidden("device does not own this session"));
        }

        if session.status == RecyclingSessionStatus::Completed {
            return Ok(session);
        }
        if let Some(existing) = PgDepositRepo::new(self.pool.clone())
            .get_by_session(session.id)
            .await?
        {
            let completed = repo
                .set_status(session.id, RecyclingSessionStatus::Completed, None)
                .await
                .unwrap_or(session.clone());
            let _ = existing;
            self.publish(&completed).await;
            return repo.get(session.id).await?.ok_or(AppError::NotFound("session"));
        }

        if session.expires_at <= Utc::now() {
            let expired = repo
                .set_status(session.id, RecyclingSessionStatus::Expired, None)
                .await?;
            self.publish(&expired).await;
            return Err(AppError::BadRequest("session expired".into()));
        }
        if !session.status.can_measure() {
            return Err(AppError::Conflict(
                "session is not ready for a measurement".into(),
            ));
        }

        session = repo
            .set_status(session.id, RecyclingSessionStatus::Measuring, None)
            .await?;
        self.publish(&session).await;

        let weight_grams = match grams_from_kg(weight_kg) {
            Ok(grams) => grams,
            Err(err) => {
                self.fail(session.id, &err.to_string()).await?;
                return Err(AppError::BadRequest(err.to_string()));
            }
        };

        let slug = material_slug.trim().to_lowercase();
        let material = match PgMaterialRepo::new(self.pool.clone())
            .get_by_slug(&slug)
            .await?
        {
            Some(material) if material.active => material,
            Some(_) => {
                self.fail(session.id, "material is not active").await?;
                return Err(AppError::BadRequest("material is not active".into()));
            }
            None => {
                self.fail(session.id, "unknown material").await?;
                return Err(AppError::BadRequest(format!("unknown material '{slug}'")));
            }
        };

        let point_id = session
            .collection_point_id
            .ok_or_else(|| AppError::Conflict("session has no collection point".into()))?;
        let org_id = session
            .organisation_id
            .ok_or_else(|| AppError::Conflict("session has no organisation".into()))?;

        let points = PgCollectionPointRepo::new(self.pool.clone());
        if !points.supports_material(point_id, material.id).await? {
            self.fail(session.id, "this machine does not accept that material")
                .await?;
            return Err(AppError::BadRequest(
                "this machine does not accept that material".into(),
            ));
        }

        session = repo
            .set_status(session.id, RecyclingSessionStatus::Processing, None)
            .await?;
        self.publish(&session).await;

        let price = match PgMaterialRepo::new(self.pool.clone())
            .current_price(org_id, material.id)
            .await?
        {
            Some(price) => price,
            None => {
                self.fail(session.id, "no price is configured for this material")
                    .await?;
                return Err(AppError::BadRequest(
                    "no price is configured for this material".into(),
                ));
            }
        };
        let green_points = match green_points_for_deposit(weight_grams, price.price_per_kg_naira) {
            Ok(points) => points,
            Err(err) => {
                self.fail(session.id, &err.to_string()).await?;
                return Err(AppError::BadRequest(err.to_string()));
            }
        };

        let idempotency_key = format!("session:{}", session.id);
        let mut tx = self
            .pool
            .begin()
            .await
            .map_err(|err| AppError::Internal(err.into()))?;

        let deposit_id = match PgDepositRepo::insert_confirmed_in_tx(
            &mut tx,
            session.user_id,
            point_id,
            org_id,
            material.id,
            device.id,
            session.id,
            weight_grams,
            price.price_per_kg_naira,
            green_points,
            &idempotency_key,
        )
        .await
        {
            Ok(id) => id,
            Err(err) => {
                drop(tx);
                self.fail(session.id, "deposit failed").await?;
                return Err(err);
            }
        };

        if let Err(err) = PgSessionRepo::complete_in_tx(&mut tx, session.id, material.id, deposit_id)
            .await
        {
            drop(tx);
            self.fail(session.id, "could not close session").await?;
            return Err(err);
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
        .bind(point_id.as_uuid())
        .bind(material.id.as_uuid())
        .fetch_optional(&mut *tx)
        .await
        .map_err(|err| AppError::Internal(err.into()))?;

        if let Some((inventory_grams, threshold_grams)) = threshold {
            PgPickupRepo::ensure_ready_in_tx(
                &mut tx,
                org_id,
                point_id,
                material.id,
                threshold_grams,
                inventory_grams,
            )
            .await?;
        }

        tx.commit()
            .await
            .map_err(|err| AppError::Internal(err.into()))?;

        tracing::info!(
            session = %session.id,
            device = %device.external_id,
            weight_kg = kg_from_grams(weight_grams),
            green_points,
            "recycling session completed"
        );

        let completed = repo.get(session.id).await?.ok_or(AppError::NotFound("session"))?;
        self.publish(&completed).await;
        Ok(completed)
    }

    async fn fail(&self, id: RecyclingSessionId, reason: &str) -> AppResult<SessionRecord> {
        let failed = self
            .repo()
            .set_status(id, RecyclingSessionStatus::Failed, Some(reason))
            .await?;
        self.publish(&failed).await;
        Ok(failed)
    }

    async fn publish(&self, session: &SessionRecord) {
        let balance = PgUserRepo::new(self.pool.clone())
            .get_by_id(session.user_id)
            .await
            .ok()
            .flatten()
            .map(|user| user.green_points_balance);
        let payload = serde_json::json!({
            "kind": "session.updated",
            "payload": {
                "session": session_json(session),
                "greenPointsBalance": balance,
            }
        });
        self.hub.publish(session.user_id.as_uuid(), payload);
    }
}

pub fn normalize_code(raw: &str) -> AppResult<String> {
    let digits: String = raw.chars().filter(|c| c.is_ascii_digit()).collect();
    if digits.len() != 6 {
        return Err(AppError::BadRequest("session code must be 6 digits".into()));
    }
    Ok(digits)
}

fn random_code() -> String {
    format!("{:06}", rand::thread_rng().gen_range(0..1_000_000))
}

pub fn session_json(session: &SessionRecord) -> serde_json::Value {
    serde_json::json!({
        "id": session.id,
        "code": session.code,
        "status": session.status.as_str(),
        "deviceExternalId": session.device_external_id,
        "collectionPointName": session.collection_point_name,
        "materialName": session.material_name,
        "materialSlug": session.material_slug,
        "depositId": session.deposit_id,
        "failureReason": session.failure_reason,
        "expiresAt": session.expires_at,
        "connectedAt": session.connected_at,
        "completedAt": session.completed_at,
        "createdAt": session.created_at,
        "weightKg": session.weight_grams.map(kg_from_grams),
        "greenPoints": session.green_points,
    })
}

pub fn machine_session_view(session: &SessionRecord) -> serde_json::Value {
    serde_json::json!({
        "sessionId": session.id,
        "status": session.status.as_str(),
        "expiresAt": session.expires_at,
        "collectionPointName": session.collection_point_name,
        "deviceExternalId": session.device_external_id,
        "weightKg": session.weight_grams.map(kg_from_grams),
        "material": session.material_slug,
        "greenPoints": session.green_points,
        "depositId": session.deposit_id,
    })
}
