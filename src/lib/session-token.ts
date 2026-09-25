/** Session JWT verification (edge-safe, used by middleware). Tokens are minted by the API. */
import { jwtVerify } from "jose";
import type { Role } from "@contracts";

export const SESSION_COOKIE = "nt_session";
export type SessionClaims = { sub: string; name: string; roles: Role[] };

const secret = () => new TextEncoder().encode(process.env.SESSION_SECRET ?? "dev-only-change-me-0123456789abcdef");

export async function verifySession(token: string | undefined): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return { sub: String(payload.sub), name: String(payload.name), roles: (payload.roles as Role[]) ?? [] };
  } catch {
    return null;
  }
}
