# Local Development

Conserve Naija has three local processes: PostgreSQL, the FastAPI backend, and the Next.js frontend. The Wokwi machine is a separate public repository at `../conserve-naija-wokwi`.

## Prerequisites

Install:

- Python 3.12+
- `uv`
- Bun
- Docker Desktop (recommended for PostgreSQL)

## Start PostgreSQL

From the repository root:

```fish
docker compose up -d postgres
```

The compose file creates:

- database: `conserve_naija`
- user: `conserve`
- password: `conserve`
- port: `5432`

If port `5432` is already occupied by another PostgreSQL installation, stop that service or change the host port in `docker-compose.yml`. Do not point the app at an unknown existing database without checking its credentials first.

## Start the backend

Open a terminal in the repository root:

```fish
cd backend
uv sync
uv run alembic upgrade head
uv run uvicorn conserve_naija.main:app --reload --host 127.0.0.1 --port 8080
```

What these commands do:

- `uv sync` creates or updates `backend/.venv` from `pyproject.toml` and `uv.lock`.
- `uv run` executes a command inside that managed environment; you do not need to activate Python manually.
- `alembic upgrade head` creates the tables, the single Yaba Conserve Site, accepted materials, prices, and the `CN-MACHINE-001` development machine.
- `uvicorn` runs the FastAPI server with automatic reload.

Backend URLs:

- API health: http://127.0.0.1:8080/health
- API docs: http://127.0.0.1:8080/docs

Seeded citizen login:

- email: `demo@conserve-naija.local`
- password: `cn-local-demo-password`

Wokwi device credential:

- header: `Authorization: Device cn-dev-yaba-device-key`
- machine: `CN-MACHINE-001`
- site: `Yaba`

## Start the frontend

Open a second terminal in the repository root:

```fish
cd frontend
cp .env.example .env.local
bun install
bun dev
```

Open http://localhost:3000. The home page sends only the intent to start a recycling mission. It never sends a weight, reward, or completed-deposit value.

For a production-style frontend check:

```fish
bun run format
bun run lint
bun run typecheck
bun run build
```

For the backend gate:

```fish
cd backend
uv run ruff format --check .
uv run ruff check .
uv run pytest
```

## Wokwi simulator

The public simulator is cloned beside this repository:

```fish
cd /home/flames/yo/win/conserve-naija-wokwi
```

It contains a prebuilt ESP32 firmware image and `diagram.json`. Its firmware calls the compatibility endpoints under `/iot/devices/me/...`, which the FastAPI backend keeps available. The simulator currently points at the deployed Railway API; use the Wokwi viewer README or rebuild the firmware with a local API host when testing against localhost.

The simulator reports only machine measurements. CP calculation remains in the backend.

## Vercel frontend deployment

Create a Vercel project connected to this repository with **Root Directory** set to `frontend`.

Set:

```text
NEXT_PUBLIC_API_URL=https://<your-railway-backend-domain>
NEXT_PUBLIC_SITE_URL=https://<your-vercel-domain>
```

Build command: `bun run build`

Install command: `bun install`

## Railway backend deployment

Create a Railway service from this repository with the **Root Directory** set to `backend`. Railway uses `backend/Dockerfile` and `backend/railway.toml`.

Provision a Railway PostgreSQL service, then set these backend variables:

```text
CN_DATABASE_URL=postgresql+asyncpg://<user>:<password>@<host>:<port>/<database>
CN_JWT_SECRET=<long-random-secret>
CN_CORS_ORIGINS=["https://<your-vercel-domain>"]
CN_ENVIRONMENT=production
```

The Docker command runs `alembic upgrade head` before Uvicorn starts. Railway health-checks `/health` on port `8080` (or its injected `PORT`). Never use the local demo password or the local JWT secret in Railway.
