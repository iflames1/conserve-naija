use chrono::{Duration, Utc};
use cn_domain::{
    RecyclingSessionId, RecyclingSessionStatus, UserId, conserve_points_for_deposit, conserve_site_label,
    grams_from_kg, kg_from_grams,
};
use rand::Rng;
use sqlx::PgPool;

use crate::data::collection_points::PgCollectionPointRepo;
use crate::data::deposits::{FractionLine, PgDepositRepo};
use crate::data::devices::DeviceRecord;
use crate::data::materials::PgMaterialRepo;
use crate::data::pickups::PgPickupRepo;
use crate::data::sessions::{PgSessionRepo, SessionRecord};
use crate::data::users::PgUserRepo;
use crate::error::{AppError, AppResult};
use crate::routes::dto::deposit_dto;
use crate::services::realtime::RealtimeHub;

#[derive(Debug, Clone)]
pub struct WeightFraction {
    pub material_slug: String,
    pub weight_kg: f64,
}

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
            .ok_or_else(|| AppError::BadRequest("machine is not assigned to a Conserve Site".into()))?;
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

    pub async fn mark_sorting(
        &self,
        device: &DeviceRecord,
        session_id: RecyclingSessionId,
    ) -> AppResult<SessionRecord> {
        let repo = self.repo();
        repo.expire_stale().await?;
        let session = repo
            .get(session_id)
            .await?
            .ok_or(AppError::NotFound("session"))?;
        if session.device_id != Some(device.id) {
            return Err(AppError::Forbidden("device does not own this session"));
        }
        if session.status == RecyclingSessionStatus::Completed {
            return Ok(session);
        }
        if session.status != RecyclingSessionStatus::Connected
            && session.status != RecyclingSessionStatus::Sorting
        {
            return Err(AppError::Conflict("session is not ready to sort".into()));
        }
        if session.status == RecyclingSessionStatus::Sorting {
            return Ok(session);
        }
        let updated = repo
            .set_status(session.id, RecyclingSessionStatus::Sorting, None)
            .await?;
        self.publish(&updated).await;
        Ok(updated)
    }

    pub async fn measure(
        &self,
        device: &DeviceRecord,
        session_id: RecyclingSessionId,
        material_slug: &str,
        weight_kg: f64,
    ) -> AppResult<SessionRecord> {
        self.measure_fractions(
            device,
            session_id,
            vec![WeightFraction {
                material_slug: material_slug.to_owned(),
                weight_kg,
            }],
        )
        .await
    }

    pub async fn measure_fractions(
        &self,
        device: &DeviceRecord,
        session_id: RecyclingSessionId,
        incoming: Vec<WeightFraction>,
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

        let mut merged: Vec<(String, f64)> = Vec::new();
        for frac in incoming {
            let slug = frac.material_slug.trim().to_lowercase();
            if slug.is_empty() {
                return Err(AppError::BadRequest("material is required".into()));
            }
            if let Some((_, weight)) = merged.iter_mut().find(|(existing, _)| existing == &slug) {
                *weight += frac.weight_kg;
            } else {
                merged.push((slug, frac.weight_kg));
            }
        }
        if merged.is_empty() {
            return Err(AppError::BadRequest(
                "deposit has no material fractions".into(),
            ));
        }

        session = repo
            .set_status(session.id, RecyclingSessionStatus::Measuring, None)
            .await?;
        self.publish(&session).await;

        let point_id = session
            .collection_point_id
            .ok_or_else(|| AppError::Conflict("session has no Conserve Site".into()))?;
        let org_id = session
            .organisation_id
            .ok_or_else(|| AppError::Conflict("session has no organisation".into()))?;

        let materials = PgMaterialRepo::new(self.pool.clone());
        let points = PgCollectionPointRepo::new(self.pool.clone());
        let mut lines: Vec<FractionLine> = Vec::with_capacity(merged.len());
        for (slug, weight_kg) in &merged {
            let weight_grams = match grams_from_kg(*weight_kg) {
                Ok(grams) => grams,
                Err(err) => {
                    self.fail(session.id, &err.to_string()).await?;
                    return Err(AppError::BadRequest(err.to_string()));
                }
            };
            let material = match materials.get_by_slug(slug).await? {
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
            if !points.supports_material(point_id, material.id).await? {
                self.fail(session.id, "this machine does not accept that material")
                    .await?;
                return Err(AppError::BadRequest(
                    "this machine does not accept that material".into(),
                ));
            }
            let price = match materials.current_price(org_id, material.id).await? {
                Some(price) => price,
                None => {
                    self.fail(session.id, "no price is configured for this material")
                        .await?;
                    return Err(AppError::BadRequest(
                        "no price is configured for this material".into(),
                    ));
                }
            };
            let conserve_points =
                match conserve_points_for_deposit(weight_grams, price.price_per_kg_naira) {
                    Ok(points) => points,
                    Err(err) => {
                        self.fail(session.id, &err.to_string()).await?;
                        return Err(AppError::BadRequest(err.to_string()));
                    }
                };
            lines.push(FractionLine {
                material_id: material.id,
                weight_grams,
                price_per_kg_naira: price.price_per_kg_naira,
                green_points: conserve_points,
            });
        }

        session = repo
            .set_status(session.id, RecyclingSessionStatus::Processing, None)
            .await?;
        self.publish(&session).await;

        let primary = lines
            .iter()
            .max_by_key(|line| line.weight_grams)
            .expect("fractions already validated")
            .clone();
        let total_weight: i64 = lines.iter().map(|line| line.weight_grams).sum();
        let total_points: i64 = lines.iter().map(|line| line.green_points).sum();

        let idempotency_key = format!("session:{}", session.id);
        let mut tx = self
            .pool
            .begin()
            .await
            .map_err(|err| AppError::Internal(err.into()))?;

        let deposit_id = match PgDepositRepo::insert_confirmed_fractions_in_tx(
            &mut tx,
            session.user_id,
            point_id,
            org_id,
            device.id,
            session.id,
            &lines,
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

        if let Err(err) =
            PgSessionRepo::complete_in_tx(&mut tx, session.id, primary.material_id, deposit_id).await
        {
            drop(tx);
            self.fail(session.id, "could not close session").await?;
            return Err(err);
        }

        for line in &lines {
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
            .bind(line.material_id.as_uuid())
            .fetch_optional(&mut *tx)
            .await
            .map_err(|err| AppError::Internal(err.into()))?;

            if let Some((inventory_grams, threshold_grams)) = threshold {
                PgPickupRepo::ensure_ready_in_tx(
                    &mut tx,
                    org_id,
                    point_id,
                    line.material_id,
                    threshold_grams,
                    inventory_grams,
                )
                .await?;
            }
        }

        tx.commit()
            .await
            .map_err(|err| AppError::Internal(err.into()))?;

        tracing::info!(
            session = %session.id,
            device = %device.external_id,
            weight_kg = kg_from_grams(total_weight),
            conserve_points = total_points,
            fractions = lines.len(),
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
        let users = PgUserRepo::new(self.pool.clone());
        let balance = users
            .get_by_id(session.user_id)
            .await
            .ok()
            .flatten()
            .map(|user| user.green_points_balance);

        let mut deposit_count = None;
        let mut recycled_kg = None;
        let mut deposit = None;
        if session.status == RecyclingSessionStatus::Completed {
            if let Ok((count, grams)) = users.recycling_stats(session.user_id).await {
                deposit_count = Some(count);
                recycled_kg = Some(kg_from_grams(grams));
            }
            if let Some(deposit_id) = session.deposit_id {
                deposit = PgDepositRepo::new(self.pool.clone())
                    .get(deposit_id)
                    .await
                    .ok()
                    .flatten()
                    .and_then(|row| serde_json::to_value(deposit_dto(&row, None)).ok());
            }
        }

        let payload = serde_json::json!({
            "kind": "session.updated",
            "payload": {
                "session": session_json(session),
                "greenPointsBalance": balance,
                "conservePointsBalance": balance,
                "depositCount": deposit_count,
                "recycledKg": recycled_kg,
                "deposit": deposit,
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
    let site_name = session
        .collection_point_name
        .as_deref()
        .map(conserve_site_label);
    serde_json::json!({
        "id": session.id,
        "code": session.code,
        "status": session.status.as_str(),
        "deviceExternalId": session.device_external_id,
        "collectionPointName": session.collection_point_name,
        "siteName": site_name,
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
        "conservePoints": session.green_points,
        "fractions": session.fractions.iter().map(fraction_json).collect::<Vec<_>>(),
    })
}

pub fn machine_session_view(session: &SessionRecord) -> serde_json::Value {
    let site_name = session
        .collection_point_name
        .as_deref()
        .map(conserve_site_label);
    serde_json::json!({
        "sessionId": session.id,
        "status": session.status.as_str(),
        "expiresAt": session.expires_at,
        "collectionPointName": session.collection_point_name,
        "siteName": site_name,
        "deviceExternalId": session.device_external_id,
        "weightKg": session.weight_grams.map(kg_from_grams),
        "material": session.material_slug,
        "greenPoints": session.green_points,
        "conservePoints": session.green_points,
        "depositId": session.deposit_id,
        "fractions": session.fractions.iter().map(fraction_json).collect::<Vec<_>>(),
    })
}

fn fraction_json(line: &crate::data::deposits::DepositFractionRecord) -> serde_json::Value {
    serde_json::json!({
        "materialId": line.material_id,
        "materialName": line.material_name,
        "materialSlug": line.material_slug,
        "weightKg": kg_from_grams(line.weight_grams),
        "greenPoints": line.green_points,
        "conservePoints": line.green_points,
        "pricePerKgNaira": line.price_per_kg_naira,
    })
}
