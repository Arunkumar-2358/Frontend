import { NextResponse, type NextRequest } from "next/server";
import { verifySession, type SessionClaims } from "@/lib/session-token";
import { REFRESH_COOKIE, SESSION_COOKIE, clearSessionCookies, setSessionCookies, type IssuedTokens } from "@/lib/auth-cookies";
import { needsRefresh, refreshSession, rewriteCookieHeader } from "@/lib/auth-refresh";
import { canAccessPath } from "@contracts/shared/access";

// Machine-to-machine endpoints authenticate themselves in the API (token, HMAC, cron secret).
const PUBLIC = ["/login", "/api/webhooks", "/api/telephony", "/api/cron", "/api/v1/webhooks", "/api/v1/telephony", "/api/v1/cron", "/_next", "/favicon", "/sw.js", "/manifest.webmanifest"];

const apiUrl = () => (process.env.API_URL ?? "http://localhost:4000").replace(/\/$/, "");

function unauthenticated(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const url = new URL("/login", req.url);
  if (pathname !== "/") url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

/** Client context the API records against the session and rate-limits on. */
function forwardHeaders(req: NextRequest): Record<string, string> {
  const out: Record<string, string> = {};
  for (const h of ["user-agent", "x-forwarded-for", "x-real-ip"]) {
    const v = req.headers.get(h);
    if (v) out[h] = v;
  }
  return out;
}

/**
 * Signed-in check + transparent access-token refresh.
 *
 * When the access cookie is missing, invalid or about to expire and a refresh cookie
 * exists, rotate it once via the API, set both new cookies on the response AND rewrite
 * this request's Cookie header so server components, server actions and the /api/v1
 * proxy handling this very request already use the new access token.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname.startsWith(p))) return NextResponse.next();

  let claims: SessionClaims | null = null;
  let issued: IssuedTokens | null = null;
  try {
    claims = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
    const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;
    if (refreshToken && needsRefresh(claims, Math.floor(Date.now() / 1000))) {
      const out = await refreshSession(refreshToken, { apiUrl: apiUrl(), forwardHeaders: forwardHeaders(req) });
      if (out.kind === "rejected") {
        // Session is over (expired, revoked, reuse detected): drop both cookies.
        const res = unauthenticated(req);
        clearSessionCookies(res.cookies);
        return res;
      }
      if (out.kind === "ok") {
        issued = out.tokens;
        claims = await verifySession(issued.token);
        if (!claims) console.error("[auth] refreshed access token failed verification — is SESSION_SECRET the same as the API's?");
      } else {
        // API unreachable: keep the cookies. A still-valid access token carries on; otherwise sign-in is required for now.
        console.warn(`[auth] token refresh unavailable (${out.reason})`);
      }
    }
  } catch (e) {
    // Never fail a request with a 500 from middleware.
    console.error("[auth] middleware error", e instanceof Error ? e.message : e);
  }

  // Whatever happens next, a rotated pair must reach the browser: the old refresh token is spent.
  const withIssued = (res: NextResponse) => {
    if (issued) setSessionCookies(res.cookies, issued);
    return res;
  };

  if (!claims) return withIssued(unauthenticated(req));
  if (pathname === "/") return withIssued(NextResponse.redirect(new URL("/dashboard", req.url)));
  if (!canAccessPath(pathname, claims.roles)) return withIssued(NextResponse.redirect(new URL("/dashboard?denied=1", req.url)));
  if (!issued) return NextResponse.next();

  const headers = new Headers(req.headers);
  headers.set("cookie", rewriteCookieHeader(req.headers.get("cookie"), { [SESSION_COOKIE]: issued.token, [REFRESH_COOKIE]: issued.refreshToken }));
  if (pathname.startsWith("/api/v1/")) {
    // next.config `rewrites()` to an external URL drop middleware response headers, so the
    // Set-Cookie with the rotated pair would never reach the browser (and its spent refresh
    // token would later trip reuse detection). Proxy this one request from middleware instead —
    // same destination as the /api/v1/:path* rewrite, but middleware headers are kept.
    const dest = new URL(`${apiUrl()}${pathname.slice("/api".length)}${req.nextUrl.search}`);
    return withIssued(NextResponse.rewrite(dest, { request: { headers } }));
  }
  return withIssued(NextResponse.next({ request: { headers } }));
}

// Skip Next internals and public static files (logo, icons).
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"] };
