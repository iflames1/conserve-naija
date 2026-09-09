//! Multiplexed `/app` WebSocket. Auth is a first message, then the server
//! pushes `session.updated` for that user.

use axum::Router;
use axum::extract::State;
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::response::IntoResponse;
use axum::routing::get;
use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use serde_json::{Value, json};
use uuid::Uuid;

use crate::services::jwt::parse_jwt_sub;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new().route("/app", get(upgrade))
}

async fn upgrade(ws: WebSocketUpgrade, State(state): State<AppState>) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, state))
}

async fn handle_socket(socket: WebSocket, state: AppState) {
    let connection_id = Uuid::now_v7();
    let (mut sink, mut stream) = socket.split();
    let _ = sink
        .send(Message::Text(
            json!({
                "kind": "connected",
                "payload": { "connectionId": connection_id }
            })
            .to_string()
            .into(),
        ))
        .await;

    let mut user_id: Option<Uuid> = None;
    let mut events = None::<tokio::sync::broadcast::Receiver<Value>>;

    loop {
        tokio::select! {
            incoming = stream.next() => {
                let Some(Ok(msg)) = incoming else { break };
                match msg {
                    Message::Text(text) => {
                        if let Err(err) = handle_text(&state, &text, &mut user_id, &mut events, &mut sink).await {
                            let _ = sink
                                .send(Message::Text(
                                    json!({
                                        "kind": "error",
                                        "payload": { "code": "bad_request", "message": err }
                                    })
                                    .to_string()
                                    .into(),
                                ))
                                .await;
                        }
                    }
                    Message::Ping(payload) => {
                        let _ = sink.send(Message::Pong(payload)).await;
                    }
                    Message::Close(_) => break,
                    Message::Pong(_) | Message::Binary(_) => {}
                }
            }
            event = recv_event(&mut events) => {
                if let Some(value) = event {
                    if sink
                        .send(Message::Text(value.to_string().into()))
                        .await
                        .is_err()
                    {
                        break;
                    }
                }
            }
        }
    }
}

async fn recv_event(events: &mut Option<tokio::sync::broadcast::Receiver<Value>>) -> Option<Value> {
    let rx = events.as_mut()?;
    loop {
        match rx.recv().await {
            Ok(value) => return Some(value),
            Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => continue,
            Err(tokio::sync::broadcast::error::RecvError::Closed) => return None,
        }
    }
}

#[derive(Deserialize)]
struct Envelope {
    kind: String,
    #[serde(default)]
    payload: Value,
}

async fn handle_text(
    state: &AppState,
    text: &str,
    user_id: &mut Option<Uuid>,
    events: &mut Option<tokio::sync::broadcast::Receiver<Value>>,
    sink: &mut futures_util::stream::SplitSink<WebSocket, Message>,
) -> Result<(), String> {
    let envelope: Envelope = serde_json::from_str(text).map_err(|err| err.to_string())?;
    match envelope.kind.as_str() {
        "ping" => {
            let _ = sink
                .send(Message::Text(
                    json!({ "kind": "pong", "payload": {} }).to_string().into(),
                ))
                .await;
        }
        "auth" => {
            let token = envelope
                .payload
                .get("token")
                .and_then(Value::as_str)
                .unwrap_or("")
                .trim();
            let id = authenticate(state, token).await?;
            *user_id = Some(id);
            *events = Some(state.realtime.subscribe(id));
            let _ = sink
                .send(Message::Text(
                    json!({
                        "kind": "authenticated",
                        "payload": { "userId": id }
                    })
                    .to_string()
                    .into(),
                ))
                .await;
        }
        "subscribe" | "unsubscribe" => {}
        other => return Err(format!("unknown message '{other}'")),
    }
    Ok(())
}

async fn authenticate(state: &AppState, token: &str) -> Result<Uuid, String> {
    if token.is_empty() {
        return Err("missing token".into());
    }
    if state.config.test_auth {
        let raw = token.strip_prefix("Test ").unwrap_or(token).trim();
        if let Ok(id) = Uuid::parse_str(raw) {
            return Ok(id);
        }
    }
    let claims = state
        .jwt
        .verify(token)
        .await
        .map_err(|err| err.to_string())?;
    parse_jwt_sub(&claims.user_id.to_string()).map_err(|err| err.to_string())
}
