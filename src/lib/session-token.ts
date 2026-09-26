/**
 * Access-token (JWT) verification — edge-safe, used by middleware and server code.
 * Tokens are minted by the API; this mirrors Backend `src/lib/session-token.ts`.
 * Fails closed: without SESSION_SECRET every token is rejected.
 */
import { jwtVerify } from "jose";
import type { Role } from "@contracts";

export { SESSION_COOKIE, REFRESH_COOKIE } from "./auth-cookies";

/** `sid` is the API session family; `exp` is seconds since the epoch. */
export type SessionClaims = { sub: string; name: string; roles: Role[]; sid: string; exp: number };

let warned = false;
function secret(): Uint8Array | null {
  const s = process.env.SESSION_SECRET;
  if (!s) {
    if (!warned) {
      warned = true;
      console.error("[auth] SESSION_SECRET is not set — every session is rejected until it is configured");
    }
    return null;
  }
  return new TextEncoder().encode(s);
}

/** Null for a missing, expired, tampered, wrongly-signed or legacy (no `sid` / `typ: "access"`) token. */
export async function verifySession(token: string | undefined): Promise<SessionClaims | null> {
  if (!token) return null;
  const key = secret();
  if (!key) return null;
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
    if (payload.typ !== "access" || typeof payload.sid !== "string" || !payload.sid || !payload.sub || typeof payload.exp !== "number") return null;
    return {
      sub: String(payload.sub),
      name: String(payload.name ?? ""),
      roles: Array.isArray(payload.roles) ? (payload.roles as Role[]) : [],
      sid: payload.sid,
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}
