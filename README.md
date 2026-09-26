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
- **Session:** see [Auth flow](#auth-flow) below. `src/middleware.ts` verifies the access JWT (shared `SESSION_SECRET`), refreshes it when needed, and gates routes by role using the shared access table (`src/contracts/shared/access.ts`); the API enforces the same table, plus finer-grained permissions, on every call.
- **Browser-direct calls** (file download/upload, Excel exports, push subscriptions) go to `/api/v1/*` on this origin and are proxied to the API — no CORS, cookie stays httpOnly.

## Auth flow

Short-lived access token + rotating, single-use refresh token. Cookie names and options live in `src/lib/auth-cookies.ts`.

| Cookie | Holds | Flags |
| --- | --- | --- |
| `nt_session` | access JWT (HS256; claims `sub, name, roles, sid, typ:"access"`), ~15 min | httpOnly, SameSite=Lax, Secure in prod, path `/`, `maxAge = expiresIn` |
| `nt_refresh` | opaque refresh token (single use) | httpOnly, SameSite=Lax, Secure in prod, path `/`, `expires = refreshExpiresAt` |

1. **Sign in** — the login server action calls `POST /v1/auth/login` and stores both cookies (`src/lib/session.ts`).
2. **Every request** — `src/middleware.ts` verifies `nt_session` (`src/lib/session-token.ts`: HS256 only, must carry `sid` and `typ:"access"`, no fallback secret). If it is missing, invalid or expires within 60 s and `nt_refresh` exists, middleware calls `POST /v1/auth/refresh` once (4 s timeout), sets both new cookies on the response **and** rewrites this request's `Cookie` header so server components, server actions and the `/api/v1/*` proxy in the same request already use the new token. Concurrent requests carrying the same refresh token share one rotation (`src/lib/auth-refresh.ts`).
   - refresh **401/400/422** (expired, revoked, reuse detected) → both cookies cleared, redirect to `/login?next=…` (401 JSON for `/api/*`).
   - API **unreachable / 5xx / 429** → cookies kept; a still-valid access token carries on, otherwise redirect to `/login?next=…`. Middleware never returns a 500.
3. **Server components** never refresh (cookies are read-only there); a 401 from the API redirects to `/login`.
4. **Sign out** — `logout()` calls `POST /v1/auth/logout` with the refresh token (best effort, 4 s timeout) and always clears both cookies. **Profile → Signed-in devices** calls `POST /v1/auth/logout-all` with `keepCurrent: true`.

The refresh token rotates on every use and the API revokes the whole session if an already-rotated token shows up after a 20 s grace window — never retry a refresh with an old token.

## Project layout

```
src/
  app/(app)/<area>/     page.tsx (server component) · actions.ts (server actions) · client components
  app/login/            sign-in
  components/           UI kit, shell, brand
  contracts/            synced from the API — do not edit here
  lib/api/              typed API client, ApiError, JSON date revival
  components/ui/        shadcn-style primitives (button, input, dialog, dropdown-menu…) + index.tsx (the app's UI API)
  lib/                  session + auth cookies/refresh, server-action helpers, theme, Sentry scrubbing, cn()
  middleware.ts         session refresh + route gating
public/                 PWA manifest, service worker, icons, logos
tests/                  unit tests (auth/middleware refresh, navigation gating, API client, action error mapping, Sentry scrubbing)
```

## Deployment

`docker build --build-arg API_URL=https://api.internal --build-arg NEXT_PUBLIC_VAPID_PUBLIC_KEY=… .` — `API_URL` is baked into the `/api/v1` rewrites at build time and is also the runtime default for server-side calls, so build and run with the same value; it must be reachable from the web container. Runtime env: `SESSION_SECRET` (required — no fallback), `API_URL` if you need to override it, and optionally `SENTRY_DSN`. Browser Sentry needs `--build-arg NEXT_PUBLIC_SENTRY_DSN=…` at build time. The container serves on port 3000 (`node server.js`).

UI conventions: [docs/UI_CONVENTIONS.md](docs/UI_CONVENTIONS.md).
