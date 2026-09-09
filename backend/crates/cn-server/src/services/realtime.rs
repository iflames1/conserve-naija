//! Per-user fan-out for live recycling missions.
//!
//! One multiplexed `/app` WebSocket per browser, same pattern as Stacks Wars:
//! the socket is a transport, not a source of truth.

use std::collections::HashMap;
use std::sync::Arc;

use parking_lot::Mutex;
use serde_json::Value;
use tokio::sync::broadcast;
use uuid::Uuid;

const CHANNEL_CAP: usize = 64;

#[derive(Clone, Default)]
pub struct RealtimeHub {
    inner: Arc<Mutex<HashMap<Uuid, broadcast::Sender<Value>>>>,
}

impl RealtimeHub {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn subscribe(&self, user_id: Uuid) -> broadcast::Receiver<Value> {
        let mut map = self.inner.lock();
        if let Some(tx) = map.get(&user_id) {
            return tx.subscribe();
        }
        let (tx, rx) = broadcast::channel(CHANNEL_CAP);
        map.insert(user_id, tx);
        rx
    }

    pub fn publish(&self, user_id: Uuid, message: Value) {
        let tx = {
            let map = self.inner.lock();
            map.get(&user_id).cloned()
        };
        if let Some(tx) = tx {
            let _ = tx.send(message);
        }
    }
}
