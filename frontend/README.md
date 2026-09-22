# Conserve Naija — Frontend

The citizen and organisation web app for Conserve Naija. Citizens start a
recycling mission and follow it live; organisations manage Conserve Sites,
machines, inventory, and pickups.

The UI is mobile-first for citizens and denser for operators. It never decides
what a deposit is worth — it displays what the backend returns.

## Stack

| Concern      | Choice                   |
| ------------ | ------------------------ |
| Framework    | Next.js (App Router)     |
| Language     | TypeScript               |
| Styling      | Tailwind CSS + shadcn/ui |
| Client state | Zustand (auth, mission)  |
| Icons        | lucide-react             |
| Package mgr  | Bun                      |
| Lint/format  | ESLint + Prettier        |

## Prerequisites

- [Bun](https://bun.sh)
- The backend running at `http://localhost:8080` (see `../backend/README.md`)

## Run it locally

Install and configure:

```sh
bun install
cp .env.example .env.local
```

`bun install` uses the committed `bun.lock` for reproducible versions.

Start the dev server:

```sh
bun dev
```

Open <http://localhost:3000>.

### Trying the recycling loop

You need two things: a signed-in account and the machine side.

1. Create an account at <http://localhost:3000/auth/sign-up>.
2. Press **Start recycling** on the home page. A Conserve OTP appears and the
   page begins listening for updates.
3. Drive the machine side, either from the public Wokwi simulator (see
   `../docs/local-development.md`) or by calling the device endpoint directly
   with the development credential:

   ```sh
   curl -X POST http://127.0.0.1:8080/api/v1/iot/devices/me/sessions/claim \
     -H 'Authorization: Device cn-dev-yaba-device-key' \
     -H 'Content-Type: application/json' \
     -d '{"code":"<the six digits shown>"}'
   ```

4. The mission page updates on its own to show the deposit and the Conserve
   Points earned.

The development machine credential and the demo account are documented in
`../docs/local-development.md`.

## Environment variables

Set these in `.env.local`. `NEXT_PUBLIC_` values are embedded at build time, so
changing them requires a restart (locally) or a redeploy (on Vercel).

| Variable               | Purpose                                                          |
| ---------------------- | ---------------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL`  | Base URL of the FastAPI service.                                 |
| `NEXT_PUBLIC_SITE_URL` | Public origin of this site, used for metadata and the sitemap.   |

## Checks

Run these before every commit:

```sh
bun run format
bun run lint
bun run typecheck
bun run build
```

`format` rewrites files with Prettier; the rest are read-only checks. The
production build is the strongest signal — it also type-checks and compiles every
route.

## Project layout

```
app/                    routes (App Router)
├── (app)/              citizen and organisation pages
├── auth/               sign in / sign up
├── layout.tsx          root shell and metadata
├── manifest.ts         PWA manifest
├── robots.ts           indexing rules
├── sitemap.ts          sitemap
├── opengraph-image.tsx social preview image
└── twitter-image.tsx   re-exports the Open Graph image
components/
├── common/             shared header and brand
├── auth/               authentication form
├── home/               mission start and live mission panel
├── organisation/       operations shell
├── ui/                 shadcn/ui primitives
└── ws/                 realtime provider
lib/                    API client, SEO/theme constants, WebSocket client
stores/                 Zustand stores
```

Route-specific components live in a `_components/` folder beside the page that
uses them. Fonts and brand assets live in `app/fonts/` and `public/`.

## Conventions

- Files and directories are `kebab-case`.
- Every page exports its own `Metadata`.
- Loading states use the shadcn `Skeleton` and mirror the real layout.
- Zustand stores separate state from actions and export one selector per value,
  so components re-render only for what they read.
- Components that depend on the signed-in user must gate on `useAuthHydrated()`
  before showing a signed-out state, otherwise persisted auth renders a flash of
  the wrong UI.
- Add shadcn components with `bunx --bun shadcn@latest add <name>`.

This will place the ui components in the `components` directory.

## Using components

To use the components in your app, import them as follows:

```tsx
import { Button } from "@/components/ui/button";
```
