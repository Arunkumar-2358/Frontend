import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session-token";
import { canAccessPath } from "@contracts/shared/access";

// Machine-to-machine endpoints authenticate themselves in the API (token, HMAC, cron secret).
const PUBLIC = ["/login", "/api/webhooks", "/api/telephony", "/api/cron", "/api/v1/webhooks", "/api/v1/telephony", "/api/v1/cron", "/_next", "/favicon", "/sw.js", "/manifest.webmanifest"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname.startsWith(p))) return NextResponse.next();
  const claims = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!claims) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    const url = new URL("/login", req.url);
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (pathname === "/") return NextResponse.redirect(new URL("/dashboard", req.url));
  if (!canAccessPath(pathname, claims.roles)) return NextResponse.redirect(new URL("/dashboard?denied=1", req.url));
  return NextResponse.next();
}

// Skip Next internals and public static files (logo, icons).
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"] };
