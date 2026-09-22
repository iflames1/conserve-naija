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
- host port: `5433` (container port remains `5432`)

The host port is `5433` because a local PostgreSQL installation commonly already owns `5432`. The backend connects to `localhost:5433`; PostgreSQL itself still listens on `5432` inside the Compose network.

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

## Accounts and roles

Anyone can create an account from `/auth/sign-up`. A signed-in user is a citizen
and can start recycling missions.

Platform administrators are configured by email, never seeded with a password.
Set `ADMIN_EMAILS` to a comma-separated list:

```text
ADMIN_EMAILS=you@example.com,teammate@example.com
```

When an account signs up or signs in with one of those emails, the backend grants
it the `admin` role and organisation administration automatically, so adding a
teammate needs no migration or manual database edit.

Administrators manage organisation access at `/organisation/members`, where they
can add an existing account by email as a member or administrator.

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

It contains the firmware source (`sketch.ino`), the wiring (`diagram.json`), and a
prebuilt `firmware.bin` that the public viewer loads. The firmware calls the
compatibility endpoints under `/iot/devices/me/...`, which the FastAPI backend
keeps available, and reports only physical measurements — CP calculation stays in
the backend.

The API host is compiled into the image. After the backend moves, rebuild it:

```fish
cd /home/flames/yo/win/conserve-naija-wokwi
pio run
cp .pio/build/esp32dev/firmware.bin firmware.bin
```

To point the simulator at your local backend instead:

```fish
PLATFORMIO_BUILD_FLAGS='-DCN_API_HOST="http://host.wokwi.internal:8080"' pio run
```

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

Create a Railway service from this repository and leave **Root Directory at the
repository root**. The backend is built by [Railpack](https://railpack.com),
Railway's default builder, using `railpack.json` there.

`railpack.json` handles the monorepo layout: it installs Python and `uv`, runs
`uv sync --project backend`, and starts the app with migrations applied first.
The root `exclude` list keeps `_legacy_backup/`, `frontend/`, virtualenvs, and
caches out of the build context.

If you prefer the built image to be reproducible bit-for-bit, keep
`uv.lock` committed — the install step runs `uv sync --frozen`, which fails rather
than silently resolving different versions.

Provision a Railway PostgreSQL service, then set these backend variables:

```text
DATABASE_URL=postgresql+asyncpg://<user>:<password>@<host>:<port>/<database>
JWT_SECRET=<long-random-secret>
CORS_ORIGINS=["https://<your-vercel-domain>"]
ENVIRONMENT=production
ADMIN_EMAILS=you@example.com
```

Notes:

- `DATABASE_URL` must use the `postgresql+asyncpg://` scheme. Railway exposes a `postgresql://` URL, so replace the scheme and keep the credentials, host, port, and database.
- `CORS_ORIGINS` must list your Vercel origin, or the browser will block API calls.
- `ADMIN_EMAILS` grants the platform administrator role on sign-up or sign-in. It is the only way an admin is created — no admin password is ever seeded.
- Setting `ENVIRONMENT=production` also prevents the local demo citizen from being seeded, so no account with a published password exists in production. On a database that was already seeded locally, that account still exists; delete it or use a fresh database.
- Do not commit a real `.env`. Set these values in the Railway dashboard.

The start command runs `alembic upgrade head` before Uvicorn. The service listens
on Railway's injected `PORT`. Railway health-checks `/health`; never use the local
demo password or the local JWT secret in Railway.

### Verifying the backend build locally

`railpack.json` can be checked before pushing. With the Railpack CLI installed:

```sh
railpack build . --show-plan
```

That prints the resolved packages, steps, and start command without building
anything. A full build needs BuildKit:

```sh
docker run --rm --privileged -d --name buildkit moby/buildkit
export BUILDKIT_HOST='docker-container://buildkit'
railpack build . --name conserve-naija-backend
```
