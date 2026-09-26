/**
 * Session cookie names and options — the one place they are defined.
 * Edge-safe (used by middleware, server actions and route handlers).
 *
 *   nt_session  short-lived access JWT (≈15 min); read by middleware, server components and the API proxy
 *   nt_refresh  opaque single-use refresh token; only ever sent to the API's /v1/auth/refresh and /logout
 */
export const SESSION_COOKIE = "nt_session";
export const REFRESH_COOKIE = "nt_refresh";

export type SessionCookieOptions = {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  maxAge?: number;
  expires?: Date;
};

const secure = () => process.env.NODE_ENV === "production";

/** Access cookie: lives exactly as long as the JWT inside it. */
export function accessCookieOptions(expiresInSeconds: number): SessionCookieOptions {
  return { httpOnly: true, sameSite: "lax", secure: secure(), path: "/", maxAge: Math.max(0, Math.floor(expiresInSeconds)) };
}

/** Refresh cookie: expires when the API stops accepting the refresh token (idle or absolute limit). */
export function refreshCookieOptions(refreshExpiresAt: string | Date): SessionCookieOptions {
  const expires = refreshExpiresAt instanceof Date ? refreshExpiresAt : new Date(refreshExpiresAt);
  return { httpOnly: true, sameSite: "lax", secure: secure(), path: "/", expires: Number.isNaN(expires.getTime()) ? new Date(0) : expires };
}

/** Options that delete a session cookie (same path/flags it was set with, expired). */
export function clearedCookieOptions(): SessionCookieOptions {
  return { httpOnly: true, sameSite: "lax", secure: secure(), path: "/", maxAge: 0, expires: new Date(0) };
}

/** The API's login/refresh response fields the cookies are built from. */
export type IssuedTokens = { token: string; expiresIn: number; refreshToken: string; refreshExpiresAt: string | Date };

type CookieJar = { set(name: string, value: string, options: SessionCookieOptions): unknown };

/** Store a freshly issued token pair (login or refresh). Works with `cookies()` and `NextResponse.cookies`. */
export function setSessionCookies(jar: CookieJar, t: IssuedTokens) {
  jar.set(SESSION_COOKIE, t.token, accessCookieOptions(t.expiresIn));
  jar.set(REFRESH_COOKIE, t.refreshToken, refreshCookieOptions(t.refreshExpiresAt));
}

export function clearSessionCookies(jar: CookieJar) {
  jar.set(SESSION_COOKIE, "", clearedCookieOptions());
  jar.set(REFRESH_COOKIE, "", clearedCookieOptions());
}
