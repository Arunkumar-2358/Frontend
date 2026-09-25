# Recruit CRM — Web

The Next.js front end for **Nextenti Recruit CRM**. It renders the role-aware UI and talks to [`Backend`](../Backend) for every read and write — this app has no database access (ESLint enforces it). Architecture decision: `Backend/docs/adr/0001-split-web-and-api.md`.

```
Browser ──► Next.js (this repo)
              ├─ server components ──► api("GET /v1/…")  ─┐
              ├─ server actions    ──► api("POST /v1/…") ─┼─ Bearer JWT from the httpOnly nt_session cookie ─► Backend (API)
              └─ /api/v1/* rewrite (downloads, uploads, push) ─┘
```

## Stack

Next.js 15 (App Router, standalone output) · React 19 · TypeScript · Tailwind CSS 4 · Vitest

## Quick start

Run the API first (see its README), then:

```bash
npm install
cp .env.example .env.local     # API_URL, SESSION_SECRET (same value as the API), NEXT_PUBLIC_VAPID_PUBLIC_KEY
npm run dev                    # http://localhost:3000
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` · `build` · `start` | Next.js dev server · production build · production server |
| `npm run lint` · `typecheck` · `test` | ESLint (incl. the no-DB boundary rule) · `tsc` · Vitest unit tests |
| `npm run contracts:sync` | Copy the API's `contracts/` into `src/contracts/` (from `../Backend` or `$API_CONTRACTS_DIR`) |
| `npm run contracts:check` | Fail if `src/contracts/` is stale |

## How data flows

- **Reads:** pages are server components that call `api("GET /v1/…", { params, query })` from `src/lib/api/client.ts`. The call is typed from `src/contracts` (params, query, body and response), forwards the session as a bearer token, revives ISO dates into `Date`, and redirects to `/login` on 401.
- **Writes:** forms keep React's `useActionState` via `<ActionForm>`. Each server action parses `FormData`, calls the API and returns its message; `run()` in `src/lib/action.ts` maps API errors (gate failures, validation, permissions) back to inline form messages.
- **Session:** `POST /v1/auth/login` returns a JWT that the login action stores in the httpOnly `nt_session` cookie. `src/middleware.ts` verifies it (shared `SESSION_SECRET`) and gates routes by role using the shared access table (`src/contracts/shared/access.ts`); the API enforces the same table, plus finer-grained permissions, on every call.
- **Browser-direct calls** (file download/upload, Excel exports, push subscriptions) go to `/api/v1/*` on this origin and are proxied to the API — no CORS, cookie stays httpOnly.

## Project layout

```
src/
  app/(app)/<area>/     page.tsx (server component) · actions.ts (server actions) · client components
  app/login/            sign-in
  components/           UI kit, shell, brand
  contracts/            synced from the API — do not edit here
  lib/api/              typed API client, ApiError, JSON date revival
  lib/                  session, server-action helpers, theme
  middleware.ts         session + route gating
public/                 PWA manifest, service worker, icons, logos
tests/                  unit tests (navigation gating, API client, action error mapping)
```

## Deployment

`docker build --build-arg API_URL=https://api.internal --build-arg NEXT_PUBLIC_VAPID_PUBLIC_KEY=… .` — `API_URL` is baked into the `/api/v1` rewrites at build time and is also the runtime default for server-side calls, so build and run with the same value; it must be reachable from the web container. Runtime env: `SESSION_SECRET` (and `API_URL` if you need to override it). The container serves on port 3000 (`node server.js`).

UI conventions: [docs/UI_CONVENTIONS.md](docs/UI_CONVENTIONS.md).
