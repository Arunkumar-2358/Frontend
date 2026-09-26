/**
 * Access-token refresh helpers for middleware (edge-safe, no Next imports so they unit-test cleanly).
 *
 * The refresh token is SINGLE USE: the API rotates it on every call and treats a
 * rotated token seen again (after a 20 s grace window) as theft, revoking the whole
 * session. So: never retry a refresh, always persist whatever a successful refresh
 * returned, and share one in-flight rotation between concurrent requests.
 */
import type { IssuedTokens } from "./auth-cookies";

/** Refresh when the access token is missing/invalid or has this many seconds (or fewer) left. */
export const REFRESH_SKEW_SECONDS = 60;
export const REFRESH_TIMEOUT_MS = 4_000;

/** True when the request should try the refresh token before continuing. `nowSeconds` is Unix time. */
export function needsRefresh(claims: { exp: number } | null, nowSeconds: number, skew = REFRESH_SKEW_SECONDS): boolean {
  if (!claims) return true;
  return claims.exp - nowSeconds <= skew;
}

/**
 * Rewrite a request `Cookie` header: set (string) or remove (null) the named cookies,
 * leaving every other cookie untouched and in order.
 */
export function rewriteCookieHeader(header: string | null | undefined, updates: Record<string, string | null>): string {
  const pending = new Map(Object.entries(updates));
  const out: string[] = [];
  for (const part of (header ?? "").split(";")) {
    const pair = part.trim();
    if (!pair) continue;
    const eq = pair.indexOf("=");
    const name = eq === -1 ? pair : pair.slice(0, eq).trim();
    if (pending.has(name)) {
      const v = pending.get(name);
      pending.delete(name);
      if (v !== null && v !== undefined) out.push(`${name}=${v}`);
      continue;
    }
    // A duplicate of a cookie we already rewrote: drop it so the new value is unambiguous.
    if (name in updates) continue;
    out.push(pair);
  }
  for (const [name, v] of pending) if (v !== null && v !== undefined) out.push(`${name}=${v}`);
  return out.join("; ");
}

export type RefreshOutcome =
  /** New token pair; the old refresh token is now spent. */
  | { kind: "ok"; tokens: IssuedTokens }
  /** The API said the session is over (expired, revoked, reused, malformed): sign in again. */
  | { kind: "rejected"; status: number }
  /** Network error, timeout, 5xx, 429 or an unreadable body — session state unknown; keep the cookies. */
  | { kind: "unavailable"; reason: string };

export type RefreshOptions = {
  apiUrl: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  /** Client context for the API's session list / rate limiting (user-agent, x-forwarded-for). */
  forwardHeaders?: Record<string, string>;
};

/** Call `POST /v1/auth/refresh` once. Never throws. */
export async function callRefresh(refreshToken: string, opts: RefreshOptions): Promise<RefreshOutcome> {
  const f = opts.fetchImpl ?? fetch;
  let res: Response;
  try {
    res = await f(`${opts.apiUrl.replace(/\/$/, "")}/v1/auth/refresh`, {
      method: "POST",
      headers: { ...opts.forwardHeaders, accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
      signal: AbortSignal.timeout(opts.timeoutMs ?? REFRESH_TIMEOUT_MS),
    });
  } catch (e) {
    return { kind: "unavailable", reason: e instanceof Error ? e.name : "fetch failed" };
  }
  if (res.status === 400 || res.status === 401 || res.status === 422) return { kind: "rejected", status: res.status };
  if (!res.ok) return { kind: "unavailable", reason: `HTTP ${res.status}` };
  try {
    const body = (await res.json()) as Partial<IssuedTokens>;
    if (typeof body.token !== "string" || typeof body.refreshToken !== "string" || typeof body.expiresIn !== "number" || !body.refreshExpiresAt) {
      return { kind: "unavailable", reason: "malformed refresh response" };
    }
    return { kind: "ok", tokens: { token: body.token, expiresIn: body.expiresIn, refreshToken: body.refreshToken, refreshExpiresAt: String(body.refreshExpiresAt) } };
  } catch {
    return { kind: "unavailable", reason: "unreadable refresh response" };
  }
}

/**
 * Concurrent requests from one browser (RSC fetches, prefetches, the /api/v1 proxy)
 * all carry the same refresh token. Share one rotation between them and remember the
 * result briefly, so a request that raced the new cookie gets the same new pair instead
 * of spending the old token again. The window stays inside the API's 20 s reuse grace.
 */
const SHARE_MS = 10_000;
const MAX_ENTRIES = 500;
const shared = new Map<string, { at: number; outcome: Promise<RefreshOutcome> }>();

export function refreshSession(refreshToken: string, opts: RefreshOptions & { now?: () => number }): Promise<RefreshOutcome> {
  const now = opts.now ?? Date.now;
  const t = now();
  for (const [k, v] of shared) if (t - v.at > SHARE_MS) shared.delete(k);
  const hit = shared.get(refreshToken);
  if (hit) return hit.outcome;
  if (shared.size >= MAX_ENTRIES) shared.delete(shared.keys().next().value as string);
  const outcome = callRefresh(refreshToken, opts).then((o) => {
    // Transient failures must not stick: the next request may retry with the (unspent) token.
    if (o.kind === "unavailable") shared.delete(refreshToken);
    return o;
  });
  shared.set(refreshToken, { at: t, outcome });
  return outcome;
}

/** Test hook. */
export function _resetRefreshShare() {
  shared.clear();
}
