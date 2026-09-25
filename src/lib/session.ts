import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Actor } from "@contracts";
import { api } from "./api/client";
import { ApiError } from "./api/errors";
import { SESSION_COOKIE, verifySession } from "./session-token";
import { THEME_COOKIE } from "./theme";

export type UserActor = Extract<Actor, { kind: "user" }>;

/** The app-shell payload for this request (deduplicated across layout + page). */
export const getShell = cache(() => api("GET /v1/me/shell"));

/** Sign in through the API and store the session token; returns an error code or null. */
export async function login(email: string, password: string): Promise<"invalid" | "rate" | null> {
  try {
    const { token, expiresIn, user } = await api("POST /v1/auth/login", { body: { email, password }, auth: false });
    const jar = await cookies();
    jar.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: expiresIn });
    jar.set(THEME_COOKIE, user.theme, { sameSite: "lax", path: "/", maxAge: 365 * 86400 });
    return null;
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 422)) return "invalid";
    if (e instanceof ApiError && e.status === 429) return "rate";
    throw e;
  }
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
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
