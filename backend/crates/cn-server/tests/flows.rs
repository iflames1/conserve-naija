use std::net::SocketAddr;
use std::time::Duration;

use cn_domain::{OrganisationId, UserId};
use cn_server::config::Config;
use cn_server::data::organisations::PgOrganisationRepo;
use cn_server::data::users::PgUserRepo;
use cn_server::infra::postgres;
use cn_server::routes;
use cn_server::state::AppState;
use serde_json::{Value, json};
use uuid::Uuid;

const ORG: &str = "00000000-0000-7000-8000-000000000001";
const PLASTIC: &str = "00000000-0000-7000-8000-000000000010";
const LEKKI: &str = "00000000-0000-7000-8000-000000000021";
const DEVICE_KEY: &str = "cn-dev-lekki-device-key";

#[tokio::test]
async fn happy_path_mission_iot_and_pickup() {
    let ctx = TestCtx::boot().await;
    ctx.reset_lekki().await;

    let user = Uuid::now_v7();
    ctx.upsert_user(user, &format!("citizen-{user}@test.local"), "Ada")
        .await;

    let points = ctx.get("/collection-points", None).await;
    assert!(
        points
            .as_array()
            .unwrap()
            .iter()
            .any(|p| p["name"] == "Lekki Collection Point")
    );

    let started = ctx
        .post("/recycling-sessions", Some(user), json!({}))
        .await;
    assert_eq!(started["status"], "waiting_for_machine");
    let code = started["code"].as_str().unwrap().to_owned();
    let session_id = started["id"].as_str().unwrap().to_owned();
    assert_eq!(code.len(), 6);

    let claimed = ctx
        .device_post(
            "/iot/devices/me/sessions/claim",
            json!({ "code": format!("{} {}", &code[..3], &code[3..]) }),
        )
        .await;
    assert_eq!(claimed["status"], "connected");
    assert_eq!(claimed["sessionId"], session_id);

    let live = ctx
        .get(&format!("/recycling-sessions/{session_id}"), Some(user))
        .await;
    assert_eq!(live["status"], "connected");
    assert_eq!(live["deviceExternalId"], "lekki-bin-01");

    let measured = ctx
        .device_post(
            &format!("/iot/devices/me/sessions/{session_id}/measurement"),
            json!({ "material": "plastic", "weightKg": 2.5 }),
        )
        .await;
    assert_eq!(measured["status"], "completed");
    assert_eq!(measured["weightKg"], 2.5);
    assert_eq!(measured["greenPoints"], 250);

    let me = ctx.get("/me", Some(user)).await;
    assert_eq!(me["greenPointsBalance"], 250);
    assert_eq!(me["depositCount"], 1);
    assert_eq!(me["recycledKg"], 2.5);

    let history = ctx.get("/me/rewards/transactions", Some(user)).await;
    assert_eq!(history[0]["amount"], 250);
    assert_eq!(history[0]["entryType"], "deposit_reward");

    let again = ctx
        .device_post(
            &format!("/iot/devices/me/sessions/{session_id}/measurement"),
            json!({ "material": "plastic", "weightKg": 2.5 }),
        )
        .await;
    assert_eq!(again["greenPoints"], 250);
    let me = ctx.get("/me", Some(user)).await;
    assert_eq!(me["greenPointsBalance"], 250);

    let reused = ctx
        .device_post_status(
            "/iot/devices/me/sessions/claim",
            DEVICE_KEY,
            json!({ "code": code }),
        )
        .await;
    assert_eq!(reused, 409);

    ctx.device_post(
        "/iot/devices/me/telemetry",
        json!({
            "location": { "latitude": 6.44, "longitude": 3.47 },
            "bins": [{ "material": "plastic", "weightKg": 82.4, "fillPercent": 82 }]
        }),
    )
    .await;

    let org_user = Uuid::now_v7();
    ctx.upsert_user(org_user, &format!("ops-{org_user}@recycle.local"), "Ops")
        .await;
    ctx.add_org_member(org_user).await;

    let devices = ctx.get("/organisation/devices", Some(org_user)).await;
    let lekki = devices
        .as_array()
        .unwrap()
        .iter()
        .find(|d| d["externalId"] == "lekki-bin-01")
        .unwrap();
    assert_eq!(lekki["health"], "online");
    assert_eq!(lekki["bins"][0]["weightKg"], 82.4);

    let second = ctx
        .post("/recycling-sessions", Some(user), json!({}))
        .await;
    ctx.device_post(
        "/iot/devices/me/sessions/claim",
        json!({ "code": second["code"] }),
    )
    .await;
    ctx.device_post(
        &format!(
            "/iot/devices/me/sessions/{}/measurement",
            second["id"].as_str().unwrap()
        ),
        json!({ "material": "plastic", "weightKg": 2.5 }),
    )
    .await;

    let pickups = ctx.get("/organisation/pickups", Some(org_user)).await;
    let ready = pickups
        .as_array()
        .unwrap()
        .iter()
        .find(|p| p["status"] == "ready" && p["collectionPointId"] == LEKKI)
        .expect("pickup ready after threshold");
    let pickup_id = ready["id"].as_str().unwrap().to_owned();

    ctx.post(
        &format!("/pickups/{pickup_id}/accept"),
        Some(org_user),
        json!({}),
    )
    .await;
    let completed = ctx
        .post(
            &format!("/pickups/{pickup_id}/complete"),
            Some(org_user),
            json!({}),
        )
        .await;
    assert_eq!(completed["status"], "completed");

    let inventory = ctx.get("/organisation/inventory", Some(org_user)).await;
    let lekki_plastic = inventory
        .as_array()
        .unwrap()
        .iter()
        .find(|row| row["collectionPointId"] == LEKKI && row["materialSlug"] == "plastic")
        .unwrap();
    assert_eq!(lekki_plastic["weightKg"], 0.0);

    let deposits = ctx.get("/organisation/deposits", Some(org_user)).await;
    assert!(
        deposits
            .as_array()
            .unwrap()
            .iter()
            .any(|d| d["greenPoints"] == 250 && d["weightKg"] == 2.5)
    );
}

#[tokio::test]
async fn rejects_invalid_inputs_and_unauthorized_access() {
    let ctx = TestCtx::boot().await;
    let user = Uuid::now_v7();
    ctx.upsert_user(user, &format!("stranger-{user}@test.local"), "Stranger")
        .await;

    let unknown = ctx
        .device_post_status(
            "/iot/devices/me/telemetry",
            "not-a-real-key",
            json!({ "bins": [] }),
        )
        .await;
    assert_eq!(unknown, 401);

    let org = ctx.get_status("/organisation", Some(user)).await;
    assert_eq!(org, 403);

    let started = ctx
        .post("/recycling-sessions", Some(user), json!({}))
        .await;
    let code = started["code"].as_str().unwrap().to_owned();
    let session_id = started["id"].as_str().unwrap().to_owned();

    ctx.device_post(
        "/iot/devices/me/sessions/claim",
        json!({ "code": code }),
    )
    .await;
    let bad_weight = ctx
        .device_post_status(
            "/iot/devices/me/sessions/{id}/measurement".replace("{id}", &session_id).as_str(),
            DEVICE_KEY,
            json!({ "material": "plastic", "weightKg": 0 }),
        )
        .await;
    assert_eq!(bad_weight, 400);

    let invalid = ctx
        .device_post_status(
            "/iot/devices/me/sessions/claim",
            DEVICE_KEY,
            json!({ "code": "000000" }),
        )
        .await;
    assert!(invalid == 400 || invalid == 409);
}

#[tokio::test]
async fn expired_session_cannot_be_claimed() {
    let ctx = TestCtx::boot().await;
    let user = Uuid::now_v7();
    ctx.upsert_user(user, &format!("exp-{user}@test.local"), "Exp")
        .await;
    let started = ctx
        .post("/recycling-sessions", Some(user), json!({}))
        .await;
    let session_id = started["id"].as_str().unwrap().to_owned();
    let code = started["code"].as_str().unwrap().to_owned();

    sqlx::query("UPDATE recycling_sessions SET expires_at = now() - interval '1 second' WHERE id = $1")
        .bind(Uuid::parse_str(&session_id).unwrap())
        .execute(&ctx.db)
        .await
        .unwrap();

    let status = ctx
        .device_post_status(
            "/iot/devices/me/sessions/claim",
            DEVICE_KEY,
            json!({ "code": code }),
        )
        .await;
    assert_eq!(status, 400);
}

#[tokio::test]
async fn price_change_does_not_rewrite_history() {
    let ctx = TestCtx::boot().await;
    ctx.reset_lekki().await;
    let user = Uuid::now_v7();
    let org_user = Uuid::now_v7();
    ctx.upsert_user(user, &format!("hist-{user}@test.local"), "Hist")
        .await;
    ctx.upsert_user(
        org_user,
        &format!("price-{org_user}@recycle.local"),
        "Price",
    )
    .await;
    ctx.add_org_member(org_user).await;

    let first = ctx.complete_mission(user, 2.5).await;
    assert_eq!(first["greenPoints"], 250);

    ctx.post(
        "/organisation/material-prices",
        Some(org_user),
        json!({ "materialId": PLASTIC, "pricePerKgNaira": 200 }),
    )
    .await;

    let next = ctx.complete_mission(user, 2.5).await;
    assert_eq!(next["greenPoints"], 500);

    let historical = ctx
        .get(
            &format!("/deposits/{}", first["depositId"].as_str().unwrap()),
            Some(user),
        )
        .await;
    assert_eq!(historical["greenPoints"], 250);
    assert_eq!(historical["pricePerKgNaira"], 100);

    ctx.post(
        "/organisation/material-prices",
        Some(org_user),
        json!({ "materialId": PLASTIC, "pricePerKgNaira": 100 }),
    )
    .await;
}

#[tokio::test]
async fn organisation_can_register_machine_and_point() {
    let ctx = TestCtx::boot().await;
    let org_user = Uuid::now_v7();
    ctx.upsert_user(org_user, &format!("reg-{org_user}@recycle.local"), "Reg")
        .await;
    ctx.add_org_member(org_user).await;

    let point = ctx
        .post(
            "/organisation/collection-points",
            Some(org_user),
            json!({
                "name": format!("Ikeja Yard {org_user}"),
                "address": "Allen Avenue, Ikeja",
                "thresholdKg": 5.0
            }),
        )
        .await;
    assert!(point["name"].as_str().unwrap().starts_with("Ikeja Yard"));

    let registered = ctx
        .post(
            "/organisation/devices",
            Some(org_user),
            json!({
                "externalId": format!("CN-TEST-{org_user}"),
                "collectionPointId": point["id"]
            }),
        )
        .await;
    assert_eq!(registered["device"]["collectionPointId"], point["id"]);
    assert!(registered["apiKey"].as_str().unwrap().starts_with("cn_dev_"));

    let device_id = registered["device"]["id"].as_str().unwrap().to_owned();
    ctx.post(
        &format!("/organisation/devices/{device_id}/deactivate"),
        Some(org_user),
        json!({}),
    )
    .await;
    let devices = ctx.get("/organisation/devices", Some(org_user)).await;
    let found = devices
        .as_array()
        .unwrap()
        .iter()
        .find(|d| d["id"] == device_id)
        .unwrap();
    assert_eq!(found["status"], "disabled");
}

struct TestCtx {
    client: reqwest::Client,
    base: String,
    db: sqlx::PgPool,
}

impl TestCtx {
    async fn boot() -> Self {
        unsafe {
            std::env::set_var("CN_TEST_AUTH", "1");
            std::env::set_var("ADMIN", "admin@conserve.local");
        }
        let config = Config::from_env().expect("config");
        let db = postgres::connect(&config.database_url).await.expect("db");
        let state = AppState::new(config, db.clone());
        let app = routes::router(state);
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move {
            axum::serve(listener, app).await.unwrap();
        });
        wait_for(addr).await;
        Self {
            client: reqwest::Client::new(),
            base: format!("http://{addr}"),
            db,
        }
    }

    async fn reset_lekki(&self) {
        sqlx::query(
            "UPDATE collection_point_inventory SET weight_grams = 0 WHERE collection_point_id = $1",
        )
        .bind(Uuid::parse_str(LEKKI).unwrap())
        .execute(&self.db)
        .await
        .unwrap();
        sqlx::query("UPDATE pickups SET status = 'cancelled' WHERE collection_point_id = $1 AND status IN ('ready', 'accepted')")
            .bind(Uuid::parse_str(LEKKI).unwrap())
            .execute(&self.db)
            .await
            .unwrap();
        sqlx::query(
            r#"
            INSERT INTO material_prices (organisation_id, material_id, price_per_kg_naira, effective_from)
            VALUES ($1, $2, 100, now())
            "#,
        )
        .bind(Uuid::parse_str(ORG).unwrap())
        .bind(Uuid::parse_str(PLASTIC).unwrap())
        .execute(&self.db)
        .await
        .unwrap();
    }

    async fn complete_mission(&self, user: Uuid, weight_kg: f64) -> Value {
        let started = self
            .post("/recycling-sessions", Some(user), json!({}))
            .await;
        self.device_post(
            "/iot/devices/me/sessions/claim",
            json!({ "code": started["code"] }),
        )
        .await;
        self.device_post(
            &format!(
                "/iot/devices/me/sessions/{}/measurement",
                started["id"].as_str().unwrap()
            ),
            json!({ "material": "plastic", "weightKg": weight_kg }),
        )
        .await
    }

    async fn upsert_user(&self, id: Uuid, email: &str, name: &str) {
        self.post(
            "/users",
            Some(id),
            json!({
                "id": id,
                "email": email,
                "displayName": name,
                "emailVerified": true
            }),
        )
        .await;
    }

    async fn add_org_member(&self, user: Uuid) {
        let repo = PgOrganisationRepo::new(self.db.clone());
        repo.add_member(
            OrganisationId::from(Uuid::parse_str(ORG).unwrap()),
            UserId::from(user),
            "admin",
        )
        .await
        .unwrap();
        PgUserRepo::new(self.db.clone())
            .grant_role(UserId::from(user), cn_domain::UserRole::OrganisationMember)
            .await
            .unwrap();
    }

    async fn get(&self, path: &str, user: Option<Uuid>) -> Value {
        let mut req = self.client.get(format!("{}{path}", self.base));
        if let Some(user) = user {
            req = req.header("Authorization", format!("Test {user}"));
        }
        let res = req.send().await.unwrap();
        assert!(res.status().is_success(), "{} {}", path, res.status());
        res.json().await.unwrap()
    }

    async fn get_status(&self, path: &str, user: Option<Uuid>) -> u16 {
        let mut req = self.client.get(format!("{}{path}", self.base));
        if let Some(user) = user {
            req = req.header("Authorization", format!("Test {user}"));
        }
        req.send().await.unwrap().status().as_u16()
    }

    async fn post(&self, path: &str, user: Option<Uuid>, body: Value) -> Value {
        let (status, value) = self.post_status(path, user, body).await;
        assert!((200..300).contains(&status), "{path} {status} {value}");
        value
    }

    async fn post_status(&self, path: &str, user: Option<Uuid>, body: Value) -> (u16, Value) {
        let mut req = self
            .client
            .post(format!("{}{path}", self.base))
            .json(&body);
        if let Some(user) = user {
            req = req.header("Authorization", format!("Test {user}"));
        }
        let res = req.send().await.unwrap();
        let status = res.status().as_u16();
        let value = res.json().await.unwrap_or(json!({}));
        (status, value)
    }

    async fn device_post(&self, path: &str, body: Value) -> Value {
        let res = self
            .client
            .post(format!("{}{path}", self.base))
            .header("Authorization", format!("Device {DEVICE_KEY}"))
            .json(&body)
            .send()
            .await
            .unwrap();
        let status = res.status().as_u16();
        let value = res.json().await.unwrap_or(json!({}));
        assert!((200..300).contains(&status), "{path} {status} {value}");
        value
    }

    async fn device_post_status(&self, path: &str, key: &str, body: Value) -> u16 {
        self.client
            .post(format!("{}{path}", self.base))
            .header("Authorization", format!("Device {key}"))
            .json(&body)
            .send()
            .await
            .unwrap()
            .status()
            .as_u16()
    }
}

async fn wait_for(addr: SocketAddr) {
    for _ in 0..50 {
        if tokio::net::TcpStream::connect(addr).await.is_ok() {
            return;
        }
        tokio::time::sleep(Duration::from_millis(20)).await;
    }
    panic!("server did not start");
}
