import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Actor } from "@contracts";
import { api } from "./api/client";
import { ApiError } from "./api/errors";
import { verifySession } from "./session-token";
import { REFRESH_COOKIE, SESSION_COOKIE, clearSessionCookies, setSessionCookies } from "./auth-cookies";
import { THEME_COOKIE } from "./theme";

export type UserActor = Extract<Actor, { kind: "user" }>;

/** The app-shell payload for this request (deduplicated across layout + page). */
export const getShell = cache(() => api("GET /v1/me/shell"));

/** Sign in through the API and store the access + refresh cookies; returns an error code or null. */
export async function login(email: string, password: string): Promise<"invalid" | "rate" | null> {
  try {
    const result = await api("POST /v1/auth/login", { body: { email, password }, auth: false });
    const jar = await cookies();
    setSessionCookies(jar, result);
    jar.set(THEME_COOKIE, result.user.theme, { sameSite: "lax", path: "/", maxAge: 365 * 86400 });
    return null;
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 422)) return "invalid";
    if (e instanceof ApiError && e.status === 429) return "rate";
    throw e;
  }
}

/**
 * Sign this device out: revoke the session at the API (best effort — a down API
 * must not keep anyone signed in locally), then always clear both cookies.
 * Server actions / route handlers only (cookies are read-only while rendering).
 */
export async function logout() {
  const jar = await cookies();
  const refreshToken = jar.get(REFRESH_COOKIE)?.value;
  const access = jar.get(SESSION_COOKIE)?.value;
  try {
    // `token` (not the cookie default) so a 401 here never redirects mid-logout.
    await api("POST /v1/auth/logout", { body: refreshToken ? { refreshToken } : {}, ...(access ? { token: access } : { auth: false }), timeoutMs: 4_000 });
  } catch (e) {
    console.warn("[auth] API logout failed; clearing cookies anyway", e instanceof Error ? e.message : e);
  }
  clearSessionCookies(jar);
}

/** The signed-in user (roles loaded fresh from the API), or null. */
export async function currentActor(): Promise<UserActor | null> {
  if (!(await verifySession((await cookies()).get(SESSION_COOKIE)?.value))) return null;
  const { user } = await getShell();
  return { kind: "user", id: user.id, name: user.name, email: user.email, roles: user.roles };
}

/** For server components / actions: the signed-in user, or redirect to /login. */
export async function requireActor(): Promise<UserActor> {
  const a = await currentActor();
  if (!a) redirect("/login");
  return a;
}
