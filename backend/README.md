# Conserve Naija — Backend

FastAPI service that owns every recycling decision: sessions, the Conserve OTP
handshake, machine measurement validation, pricing, the Conserve Points ledger,
site inventory, and pickups.

The browser reports intent. A machine reports measurements. This service decides
what is valid.

## Stack

| Concern         | Choice                          |
| --------------- | ------------------------------- |
| Runtime         | Python 3.12                     |
| Web             | FastAPI + Uvicorn               |
| Database        | PostgreSQL                      |
| ORM/migrations  | SQLAlchemy 2 (async) + Alembic  |
| Dependencies    | `uv`                            |
| Lint/format     | `ruff`                          |
| Tests           | `pytest`                        |

## Prerequisites

- [uv](https://docs.astral.sh/uv/) — manages the Python version and virtualenv
- PostgreSQL 17 (or Docker)

You do not need to install Python or create a virtualenv yourself; `uv` handles
both from `pyproject.toml` and `uv.lock`.

## Run it locally

### 1. Start PostgreSQL

From the repository root:

```sh
docker compose up -d postgres
```

This exposes the database on host port **5433** (PostgreSQL listens on 5432
inside the container). The port is 5433 because a local PostgreSQL install often
already owns 5432.

### 2. Configure the environment

```sh
cp .env.example .env
```

Defaults in `.env.example` already match the Docker database. See
[Environment variables](#environment-variables) for what each value does.

### 3. Install dependencies and migrate

```sh
uv sync
uv run alembic upgrade head
```

`uv sync` creates `.venv` and installs everything from `uv.lock`.
`alembic upgrade head` creates the schema plus the single Yaba Conserve Site,
its accepted materials and prices, and the `CN-MACHINE-001` development machine.

### 4. Run the API

```sh
uv run uvicorn conserve_naija.main:app --reload --host 127.0.0.1 --port 8080
```

- Health: <http://127.0.0.1:8080/health>
- Interactive docs: <http://127.0.0.1:8080/docs>

`uv run` executes inside the managed virtualenv, so there is nothing to
activate.

## Environment variables

All values are read from the environment (or `.env`). There is no prefix.

| Variable        | Purpose                                                                |
| --------------- | ---------------------------------------------------------------------- |
| `ENVIRONMENT`   | `local` or `production`. `production` skips the demo account during seed. |
| `DATABASE_URL`  | SQLAlchemy async URL. **Must** use `postgresql+asyncpg://`.            |
| `JWT_SECRET`    | Signs and verifies account tokens. Use a long random value in production. |
| `CORS_ORIGINS`  | Allowed browser origins. JSON array or comma-separated.                |
| `ADMIN_EMAILS`  | Comma-separated emails granted the platform admin role.                |

`ADMIN_EMAILS` is the only way an administrator is created — no admin password is
ever seeded. Any account that signs up or signs in with one of those emails is
granted `admin` plus organisation administration automatically.

## Tests and checks

Run these before every commit:

```sh
uv run ruff format --check .
uv run ruff check .
uv run pytest
```

With the API running, the end-to-end flow check:

```sh
uv run python scripts/smoke_flow.py --admin-email you@example.com
```

It exercises sign-up, sign-in, admin roles, organisation membership, the
browser-versus-machine trust boundary, the Conserve OTP handshake, reward
calculation, and machine-retry idempotency. It exits non-zero on failure.

## Project layout

```
src/conserve_naija/
├── api/          HTTP routes, WebSocket, request/response schemas, auth dependencies
├── db/           async engine, session factory, declarative base
├── domain/       pure rules: rewards, OTP, session state machine
├── models/       SQLAlchemy models
└── services/     transactional operations and identity helpers
alembic/          migrations
scripts/          developer utilities
tests/            unit tests
```

## Trust boundary

Keep this intact when contributing:

- The browser can create, read, and cancel its own session. It can never submit a
  weight, a reward, or a completed deposit.
- Only an authenticated machine with an active credential may claim an OTP and
  submit measured fractions.
- Deposit confirmation snapshots price and reward per fraction, writes the
  ledger, updates inventory, and evaluates pickup readiness in one transaction.
- A repeated machine measurement returns the original deposit and does not award
  Conserve Points twice.
