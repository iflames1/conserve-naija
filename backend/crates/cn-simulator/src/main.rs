//! Protocol-compatible IoT client.
//!
//! Speaks the same HTTP device API a Wokwi ESP32 uses. Replacing this
//! process with firmware does not change backend domain behaviour.

use std::time::Duration;

use anyhow::{Context, Result, bail};
use serde_json::{Value, json};

#[tokio::main]
async fn main() -> Result<()> {
    let api = std::env::var("API_URL").unwrap_or_else(|_| "http://127.0.0.1:8080".into());
    let key = std::env::var("DEVICE_API_KEY")
        .unwrap_or_else(|_| "cn-dev-yaba-device-key".into());
    let oneshot = std::env::args().any(|arg| arg == "--once");
    let measure_kg = std::env::var("MEASURE_KG")
        .ok()
        .and_then(|v| v.parse::<f64>().ok())
        .unwrap_or(2.5);
    let material = std::env::var("MATERIAL").unwrap_or_else(|_| "plastic".into());
    let fill = std::env::var("FILL_PERCENT")
        .ok()
        .and_then(|v| v.parse::<i32>().ok())
        .unwrap_or(42);
    let claim_code = std::env::var("CLAIM_CODE")
        .ok()
        .map(|v| v.chars().filter(|c| c.is_ascii_digit()).collect::<String>())
        .filter(|v| !v.is_empty());

    let client = reqwest::Client::new();
    let mut tick = 0u32;
    loop {
        tick += 1;
        let weight = 40.0 + (tick as f64 * 1.7) % 50.0;
        heartbeat(&client, &api, &key).await?;
        telemetry(&client, &api, &key, weight, fill).await?;
        if let Some(code) = &claim_code {
            let session = claim(&client, &api, &key, code).await?;
            let session_id = session["sessionId"]
                .as_str()
                .or_else(|| session["id"].as_str())
                .context("claim missing session id")?
                .to_owned();
            println!("claimed session {session_id}");
            let done = measure(&client, &api, &key, &session_id, &material, measure_kg).await?;
            println!(
                "deposit complete cp={} weightKg={}",
                done["conservePoints"]
                    .as_i64()
                    .or_else(|| done["greenPoints"].as_i64())
                    .unwrap_or(0),
                done["weightKg"]
            );
        }
        if oneshot {
            break;
        }
        tokio::time::sleep(Duration::from_secs(5)).await;
    }
    Ok(())
}

fn device_headers(key: &str) -> reqwest::header::HeaderMap {
    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert(
        reqwest::header::AUTHORIZATION,
        format!("Device {key}").parse().expect("device header"),
    );
    headers.insert(
        reqwest::header::CONTENT_TYPE,
        "application/json".parse().unwrap(),
    );
    headers
}

async fn heartbeat(client: &reqwest::Client, api: &str, key: &str) -> Result<()> {
    let res = client
        .post(format!("{api}/iot/devices/me/heartbeat"))
        .headers(device_headers(key))
        .json(&json!({
            "latitude": 6.5095,
            "longitude": 3.3711,
            "firmwareVersion": "sim-0.2.0"
        }))
        .send()
        .await
        .context("heartbeat")?;
    if !res.status().is_success() {
        bail!(
            "heartbeat failed: {} {}",
            res.status(),
            res.text().await.unwrap_or_default()
        );
    }
    Ok(())
}

async fn telemetry(
    client: &reqwest::Client,
    api: &str,
    key: &str,
    weight_kg: f64,
    fill_percent: i32,
) -> Result<()> {
    let res = client
        .post(format!("{api}/iot/devices/me/telemetry"))
        .headers(device_headers(key))
        .json(&json!({
            "timestamp": chrono::Utc::now().to_rfc3339(),
            "location": { "latitude": 6.5095, "longitude": 3.3711 },
            "bins": [{
                "material": "plastic",
                "weightKg": weight_kg,
                "fillPercent": fill_percent
            }]
        }))
        .send()
        .await
        .context("telemetry")?;
    if !res.status().is_success() {
        bail!(
            "telemetry failed: {} {}",
            res.status(),
            res.text().await.unwrap_or_default()
        );
    }
    println!("telemetry sent weight_kg={weight_kg:.1} fill={fill_percent}");
    Ok(())
}

async fn claim(client: &reqwest::Client, api: &str, key: &str, code: &str) -> Result<Value> {
    let res = client
        .post(format!("{api}/iot/devices/me/sessions/claim"))
        .headers(device_headers(key))
        .json(&json!({ "code": code }))
        .send()
        .await
        .context("claim")?;
    let status = res.status();
    let body = res.json::<Value>().await.unwrap_or(json!({}));
    if !status.is_success() {
        bail!("claim failed: {status} {body}");
    }
    Ok(body)
}

async fn measure(
    client: &reqwest::Client,
    api: &str,
    key: &str,
    session_id: &str,
    material: &str,
    weight_kg: f64,
) -> Result<Value> {
    let res = client
        .post(format!(
            "{api}/iot/devices/me/sessions/{session_id}/measurement"
        ))
        .headers(device_headers(key))
        .json(&json!({ "material": material, "weightKg": weight_kg }))
        .send()
        .await
        .context("measure")?;
    let status = res.status();
    let body = res.json::<Value>().await.unwrap_or(json!({}));
    if !status.is_success() {
        bail!("measure failed: {status} {body}");
    }
    Ok(body)
}
