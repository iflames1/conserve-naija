# Conserve Naija

**Keeping resources in circulation.**

Conserve Naija is an IoT-connected recycling incentive platform. People walk up to a Conserve machine, start a recycling mission on their phone, enter a short-lived session code, and deposit recyclables. The **machine** measures the material. The **backend** prices it and credits Green Points. Recycling organisations operate the network.

1 Green Point = ₦1.

Plastic is the first material. Materials, prices, inventory, and devices are data — the domain is not plastic-shaped.

## Architecture

```
Citizen app (Next.js)                 Organisation dashboard
        │  JWT + /app WebSocket                │
        ▼                                      ▼
                 Rust API  (Axum + SQLx)
                          │
            ┌─────────────┼─────────────┐
            ▼             ▼             ▼
     PostgreSQL      Device auth     Green Point
     (Docker)        Device <key>    ledger

Wokwi ESP32 / cn-simulator
  claim session code → measure weight → backend creates deposit
```

The frontend never creates a completed deposit. It never sends a weight or a Green Point amount.

Better Auth lives in the Next.js app and writes to the same `users` table. The Rust server verifies JWTs, owns sessions, deposits, pricing, ledger, inventory, telemetry, and pickups.

## Core loop

1. Citizen taps **Start a recycling mission**.
2. Backend creates a 6-digit, single-use session (expires in 2 minutes while waiting).
3. Citizen enters the code on the machine.
4. Machine authenticates as a registered device and claims the session. That binds the session to the machine's collection point.
5. Machine weighs material and POSTs the measurement.
6. Backend validates, snapshots ₦/kg, writes a confirmed deposit, credits the ledger, updates inventory, and may open a pickup.
7. Phone updates live over `/app`. Machine shows success and returns to idle.

## Run locally

You need Docker, Rust, and Bun.

```bash
docker compose up -d postgres

# backend — SQL in backend/migrations runs on boot
cd backend
cargo run

# frontend (second terminal)
cd frontend
bun install
bun dev

# optional idle IoT heartbeat (third terminal)
cd backend
DEVICE_API_KEY=cn-dev-yaba-device-key cargo run -p cn-simulator
```

SQL lives in `backend/migrations/` (SQLx). The server applies it when it starts. From `backend/`:

```bash
# one-time: cargo install sqlx-cli --no-default-features --features rustls,postgres
cargo migrate          # sqlx migrate run --source migrations
cargo migrate-info     # applied / pending
cargo migrate-add name # new reversible pair
```

App: [http://localhost:3000](http://localhost:3000)  
API: [http://127.0.0.1:8080/health](http://127.0.0.1:8080/health)  
Live socket: `ws://127.0.0.1:8080/app`

### Complete a mission without Wokwi

```bash
# after starting a mission in the app, copy the 6-digit code
cd backend
CLAIM_CODE=482731 MEASURE_KG=2.5 DEVICE_API_KEY=cn-dev-yaba-device-key \
  cargo run -p cn-simulator -- --once
```

A 2.5 kg plastic deposit at ₦100/kg awards **250 Green Points**.

### Production (Railway)

Postgres runs as its own Docker service on Railway.

1. **Postgres** — new Railway service, root `infra/postgres`. Mount a volume at `/var/lib/postgresql/data`. Set `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB=conserve_naija`.
2. **cn-server** — new Railway service, root `backend`. Set:
   - `DATABASE_URL=postgres://USER:PASSWORD@<postgres-private-host>:5432/conserve_naija`
   - `HOST=0.0.0.0` and `PORT` (Railway injects `PORT`)
   - `APP_URL` — public site origin (JWKS)
   - `INTERNAL_API_SECRET`
3. **Frontend** (Vercel) — `DATABASE_URL` is the Railway Postgres public/TCP URL (`sslmode=require`) so Better Auth hits the same database. `API_URL` is the cn-server public URL.

The private hostname looks like `xxx.railway.internal`. Use that on the Rust service. The public Postgres URL is only for Next.

The Rust server applies SQLx migrations on boot.

### Organisation access

1. Create an account on `/auth/sign-up`.
2. Set `ADMIN=your@email.com` for the backend and restart it.
3. Open `/admin` and add that email to Recycle Lagos.
4. Open `/organisation`.

Google OAuth is wired. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` and add `http://localhost:3000/api/auth/callback/google` as the redirect URI.

## Seeded network

| Entity | Value |
| --- | --- |
| Organisation | Recycle Lagos |
| Points | Lekki, Yaba |
| Plastic price | ₦100 / kg |
| Yaba machine | `CN-MACHINE-001` / `cn-dev-yaba-device-key` |
| Lekki machine | `lekki-bin-01` / `cn-dev-lekki-device-key` |
| Pickup threshold | 5 kg |

## Device protocol

Machines authenticate with `Authorization: Device <key>`. The key is hashed at rest (SHA-256). Unauthenticated callers cannot pretend to be `CN-MACHINE-001`.

| Method | Path | Meaning |
| --- | --- | --- |
| GET | `/iot/devices/me` | Identity + health |
| POST | `/iot/devices/me/heartbeat` | last_seen |
| POST | `/iot/devices/me/telemetry` | Bin observation (not a deposit) |
| POST | `/iot/devices/me/sessions/claim` | Bind a waiting session to this machine |
| POST | `/iot/devices/me/sessions/{id}/measurement` | Authoritative measurement; backend rewards |

Citizen:

| Method | Path |
| --- | --- |
| POST | `/recycling-sessions` |
| GET | `/recycling-sessions/active` |
| GET | `/recycling-sessions/{id}` |
| POST | `/recycling-sessions/{id}/cancel` |
| GET | `/app` (WebSocket) |

Telemetry is what the machine currently observes. A deposit is one person's recycling event. They are not the same.

## Tests

```bash
cd backend
cargo test --workspace -- --test-threads=1

# Better Auth against a running frontend
node scripts/e2e-auth.mjs
```

Integration tests cover the mission → claim → measure → reward → inventory → pickup path, idempotent re-measurement, expiry, organisation registration, and historical prices.

## Wokwi

See [`wokwi/README.md`](wokwi/README.md). Public sim: [wokwi.com/projects/474695400040446977](https://wokwi.com/projects/474695400040446977). Firmware and `cn-simulator` share one protocol. Replacing the simulator with a real ESP32 does not change domain logic.
