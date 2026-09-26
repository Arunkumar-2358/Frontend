import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { SignJWT, UnsecuredJWT } from "jose";
import { NextRequest } from "next/server";
import { verifySession } from "@/lib/session-token";
import { accessCookieOptions, clearedCookieOptions, refreshCookieOptions, REFRESH_COOKIE, SESSION_COOKIE } from "@/lib/auth-cookies";
import { _resetRefreshShare, callRefresh, needsRefresh, refreshSession, rewriteCookieHeader } from "@/lib/auth-refresh";
import { middleware } from "@/middleware";

const SECRET = "test-session-secret-test-session-secret-00";
const key = new TextEncoder().encode(SECRET);
const nowS = () => Math.floor(Date.now() / 1000);

type Extra = Record<string, unknown>;
async function access(opts: { sub?: string; roles?: string[]; exp?: number; alg?: string; secret?: Uint8Array; claims?: Extra } = {}) {
  const claims: Extra = opts.claims ?? { name: "Jennifer", roles: opts.roles ?? ["admin"], sid: "fam_1", typ: "access" };
  return new SignJWT(claims)
    .setProtectedHeader({ alg: opts.alg ?? "HS256" })
    .setSubject(opts.sub ?? "user_1")
    .setIssuedAt()
    .setExpirationTime(opts.exp ?? nowS() + 900)
    .sign(opts.secret ?? key);
}

beforeEach(() => {
  vi.stubEnv("SESSION_SECRET", SECRET);
  vi.stubEnv("API_URL", "http://api.test");
  _resetRefreshShare();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("verifySession", () => {
  it("accepts a current access token and returns its claims", async () => {
    const c = await verifySession(await access());
    expect(c).toMatchObject({ sub: "user_1", name: "Jennifer", roles: ["admin"], sid: "fam_1" });
    expect(typeof c?.exp).toBe("number");
  });

  it("rejects legacy tokens without sid or typ, and non-access tokens", async () => {
    expect(await verifySession(await access({ claims: { name: "J", roles: ["admin"] } }))).toBeNull();
    expect(await verifySession(await access({ claims: { name: "J", roles: ["admin"], typ: "access" } }))).toBeNull();
    expect(await verifySession(await access({ claims: { name: "J", roles: ["admin"], sid: "fam_1" } }))).toBeNull();
    expect(await verifySession(await access({ claims: { name: "J", roles: ["admin"], sid: "fam_1", typ: "refresh" } }))).toBeNull();
  });

  it("rejects other algorithms, unsigned, tampered, wrongly-signed and expired tokens", async () => {
    expect(await verifySession(await access({ alg: "HS512" }))).toBeNull();
    const unsigned = new UnsecuredJWT({ name: "J", roles: ["admin"], sid: "fam_1", typ: "access" }).setSubject("user_1").setExpirationTime("15m").encode();
    expect(await verifySession(unsigned)).toBeNull();

    const [h, , s] = (await access({ roles: ["telecaller"] })).split(".");
    const forged = Buffer.from(JSON.stringify({ sub: "user_1", name: "J", roles: ["admin"], sid: "fam_1", typ: "access", exp: nowS() + 900 })).toString("base64url");
    expect(await verifySession(`${h}.${forged}.${s}`)).toBeNull();

    expect(await verifySession(await access({ secret: new TextEncoder().encode("another-secret-another-secret-another-00") }))).toBeNull();
    expect(await verifySession(await access({ exp: nowS() - 5 }))).toBeNull();
    expect(await verifySession(undefined)).toBeNull();
    expect(await verifySession("not-a-jwt")).toBeNull();
  });

  it("fails closed without SESSION_SECRET (no dev fallback)", async () => {
    const token = await access();
    vi.stubEnv("SESSION_SECRET", "");
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await verifySession(token)).toBeNull();
    const devFallback = await access({ secret: new TextEncoder().encode("dev-only-change-me-0123456789abcdef") });
    expect(await verifySession(devFallback)).toBeNull();
  });
});

describe("refresh decision and cookie helpers", () => {
  it("needsRefresh: missing, expired or within 60 s of expiry", () => {
    const now = 1_000_000;
    expect(needsRefresh(null, now)).toBe(true);
    expect(needsRefresh({ exp: now - 1 }, now)).toBe(true);
    expect(needsRefresh({ exp: now + 60 }, now)).toBe(true);
    expect(needsRefresh({ exp: now + 61 }, now)).toBe(false);
    expect(needsRefresh({ exp: now + 900 }, now)).toBe(false);
  });

  it("builds cookie options (httpOnly, lax, path /, secure only in production)", () => {
    expect(accessCookieOptions(900)).toEqual({ httpOnly: true, sameSite: "lax", secure: false, path: "/", maxAge: 900 });
    const r = refreshCookieOptions("2026-10-10T10:00:00.000Z");
    expect(r).toMatchObject({ httpOnly: true, sameSite: "lax", secure: false, path: "/" });
    expect(r.expires?.toISOString()).toBe("2026-10-10T10:00:00.000Z");
    expect(refreshCookieOptions(new Date("2026-10-10T10:00:00.000Z")).expires?.toISOString()).toBe("2026-10-10T10:00:00.000Z");
    expect(clearedCookieOptions()).toMatchObject({ maxAge: 0, path: "/", httpOnly: true });
    vi.stubEnv("NODE_ENV", "production");
    expect(accessCookieOptions(900).secure).toBe(true);
    expect(refreshCookieOptions("2026-10-10T10:00:00.000Z").secure).toBe(true);
  });

  it("rewrites the request cookie header in place, keeping other cookies", () => {
    expect(rewriteCookieHeader("theme=dark; nt_session=old; nt_refresh=r1; x=1", { nt_session: "new", nt_refresh: "r2" })).toBe("theme=dark; nt_session=new; nt_refresh=r2; x=1");
    expect(rewriteCookieHeader("theme=dark; nt_refresh=r1", { nt_session: "new", nt_refresh: "r2" })).toBe("theme=dark; nt_refresh=r2; nt_session=new");
    expect(rewriteCookieHeader(null, { nt_session: "a" })).toBe("nt_session=a");
    expect(rewriteCookieHeader("nt_session=a; nt_session=b; y=2", { nt_session: "c" })).toBe("nt_session=c; y=2");
    expect(rewriteCookieHeader("nt_session=a; y=2", { nt_session: null })).toBe("y=2");
  });
});

const issued = async (roles = ["admin"]) => ({
  token: await access({ roles, claims: { name: "Jennifer", roles, sid: "fam_1", typ: "access" } }),
  expiresIn: 900,
  refreshToken: "sess_2.newsecret",
  refreshExpiresAt: "2026-10-10T10:00:00.000Z",
  user: { id: "user_1", name: "Jennifer", email: "jennifer@nextenti.ai", roles, theme: "light" },
});

function req(path: string, cookie?: string, extra: Record<string, string> = {}) {
  return new NextRequest(`http://localhost:3000${path}`, { headers: { ...(cookie ? { cookie } : {}), "user-agent": "vitest", ...extra } });
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("callRefresh / refreshSession", () => {
  it("maps API responses to outcomes and never throws", async () => {
    const body = await issued();
    const ok = vi.fn(async () => json(200, body));
    expect(await callRefresh("r", { apiUrl: "http://api.test/", fetchImpl: ok as unknown as typeof fetch })).toMatchObject({ kind: "ok", tokens: { refreshToken: "sess_2.newsecret" } });
    expect(ok).toHaveBeenCalledWith("http://api.test/v1/auth/refresh", expect.objectContaining({ method: "POST", body: JSON.stringify({ refreshToken: "r" }) }));
    for (const status of [400, 401, 422]) {
      expect(await callRefresh("r", { apiUrl: "http://api.test", fetchImpl: (async () => json(status, {})) as unknown as typeof fetch })).toEqual({ kind: "rejected", status });
    }
    for (const status of [429, 500, 502, 503]) {
      expect((await callRefresh("r", { apiUrl: "http://api.test", fetchImpl: (async () => json(status, {})) as unknown as typeof fetch })).kind).toBe("unavailable");
    }
    expect((await callRefresh("r", { apiUrl: "http://api.test", fetchImpl: (async () => new Response("<html>", { status: 200 })) as unknown as typeof fetch })).kind).toBe("unavailable");
    expect((await callRefresh("r", { apiUrl: "http://api.test", fetchImpl: (async () => { throw new TypeError("fetch failed"); }) as unknown as typeof fetch })).kind).toBe("unavailable");
  });

  it("aborts a slow API after the timeout", async () => {
    const slow = ((_: string, init: RequestInit) =>
      new Promise((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(init.signal?.reason)))) as unknown as typeof fetch;
    expect(await callRefresh("r", { apiUrl: "http://api.test", fetchImpl: slow, timeoutMs: 20 })).toMatchObject({ kind: "unavailable" });
  });

  it("shares one rotation between concurrent requests, but retries after a transient failure", async () => {
    const body = await issued();
    const f = vi.fn(async () => json(200, body));
    const [a, b] = await Promise.all([
      refreshSession("tok", { apiUrl: "http://api.test", fetchImpl: f as unknown as typeof fetch }),
      refreshSession("tok", { apiUrl: "http://api.test", fetchImpl: f as unknown as typeof fetch }),
    ]);
    expect(f).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);

    const down = vi.fn(async () => json(503, {}));
    await refreshSession("tok2", { apiUrl: "http://api.test", fetchImpl: down as unknown as typeof fetch });
    await refreshSession("tok2", { apiUrl: "http://api.test", fetchImpl: down as unknown as typeof fetch });
    expect(down).toHaveBeenCalledTimes(2);
  });
});

describe("middleware", () => {
  it("passes a valid, fresh access token straight through without calling the API", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    const res = await middleware(req("/dashboard", `${SESSION_COOKIE}=${await access()}; ${REFRESH_COOKIE}=sess_1.s`));
    expect(res.status).toBe(200);
    expect(f).not.toHaveBeenCalled();
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("200 from refresh: sets both cookies and forwards the NEW access token to this request", async () => {
    const body = await issued();
    const f = vi.fn(async () => json(200, body));
    vi.stubGlobal("fetch", f);
    const res = await middleware(req("/dashboard", `theme=dark; ${REFRESH_COOKIE}=sess_1.oldsecret`, { "x-forwarded-for": "203.0.113.9" }));

    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://api.test/v1/auth/refresh");
    expect(JSON.parse(String(init.body))).toEqual({ refreshToken: "sess_1.oldsecret" });
    expect(init.headers).toMatchObject({ "x-forwarded-for": "203.0.113.9", "user-agent": "vitest" });

    expect(res.status).toBe(200);
    expect(res.cookies.get(SESSION_COOKIE)).toMatchObject({ value: body.token, httpOnly: true, sameSite: "lax", path: "/", maxAge: 900 });
    expect(res.cookies.get(REFRESH_COOKIE)).toMatchObject({ value: "sess_2.newsecret", httpOnly: true, sameSite: "lax", path: "/" });
    // Forwarded to server components / the /api/v1 proxy in the same pass.
    expect(res.headers.get("x-middleware-override-headers")).toContain("cookie");
    expect(res.headers.get("x-middleware-request-cookie")).toBe(`theme=dark; ${REFRESH_COOKIE}=sess_2.newsecret; ${SESSION_COOKIE}=${body.token}`);
  });

  it("refreshes an access token that expires within 60 s", async () => {
    const body = await issued();
    const f = vi.fn(async () => json(200, body));
    vi.stubGlobal("fetch", f);
    const res = await middleware(req("/tasks", `${SESSION_COOKIE}=${await access({ exp: nowS() + 30 })}; ${REFRESH_COOKIE}=sess_1.s`));
    expect(f).toHaveBeenCalledTimes(1);
    expect(res.cookies.get(SESSION_COOKIE)?.value).toBe(body.token);
  });

  it("the /api/v1 proxy benefits from the refresh too", async () => {
    const body = await issued();
    vi.stubGlobal("fetch", vi.fn(async () => json(200, body)));
    const res = await middleware(req("/api/v1/me/shell?x=1", `${REFRESH_COOKIE}=sess_1.s`));
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-request-cookie")).toContain(`${SESSION_COOKIE}=${body.token}`);
    // Proxied from middleware (not the next.config rewrite, which drops Set-Cookie) so the browser gets the new pair.
    expect(res.headers.get("x-middleware-rewrite")).toBe("http://api.test/v1/me/shell?x=1");
    expect(res.cookies.get(REFRESH_COOKIE)?.value).toBe("sess_2.newsecret");
  });

  it("401 from refresh: clears both cookies and redirects to /login (401 JSON for /api/*)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(401, { error: { code: "UNAUTHORIZED", message: "Session expired" } })));
    const res = await middleware(req("/leads", `${REFRESH_COOKIE}=sess_1.s`));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/login?next=%2Fleads");
    expect(res.cookies.get(SESSION_COOKIE)).toMatchObject({ value: "", maxAge: 0 });
    expect(res.cookies.get(REFRESH_COOKIE)).toMatchObject({ value: "", maxAge: 0 });

    _resetRefreshShare();
    const api = await middleware(req("/api/v1/me/shell", `${REFRESH_COOKIE}=sess_1.s`));
    expect(api.status).toBe(401);
    expect(api.cookies.get(REFRESH_COOKIE)).toMatchObject({ value: "", maxAge: 0 });
  });

  it("network error: redirects to /login with next, without clearing cookies, never a 500", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));
    const res = await middleware(req("/vacancies", `${REFRESH_COOKIE}=sess_1.s`));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/login?next=%2Fvacancies");
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("network error with a still-valid (expiring) access token: carries on with it", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));
    const res = await middleware(req("/dashboard", `${SESSION_COOKIE}=${await access({ exp: nowS() + 30 })}; ${REFRESH_COOKIE}=sess_1.s`));
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("keeps the rotated cookies on redirects (/ → /dashboard, role denial)", async () => {
    const body = await issued(["telecaller"]);
    vi.stubGlobal("fetch", vi.fn(async () => json(200, body)));
    const home = await middleware(req("/", `${REFRESH_COOKIE}=sess_1.s`));
    expect(home.headers.get("location")).toBe("http://localhost:3000/dashboard");
    expect(home.cookies.get(REFRESH_COOKIE)?.value).toBe("sess_2.newsecret");

    _resetRefreshShare();
    const denied = await middleware(req("/admin", `${REFRESH_COOKIE}=sess_1.s`));
    expect(denied.headers.get("location")).toBe("http://localhost:3000/dashboard?denied=1");
    expect(denied.cookies.get(REFRESH_COOKIE)?.value).toBe("sess_2.newsecret");
  });

  it("no cookies at all: login redirect / 401, and public paths are untouched", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    expect((await middleware(req("/dashboard"))).headers.get("location")).toBe("http://localhost:3000/login?next=%2Fdashboard");
    expect((await middleware(req("/"))).headers.get("location")).toBe("http://localhost:3000/login");
    expect((await middleware(req("/api/v1/leads"))).status).toBe(401);
    expect((await middleware(req("/login", `${REFRESH_COOKIE}=sess_1.s`))).status).toBe(200);
    expect((await middleware(req("/api/v1/webhooks/x"))).status).toBe(200);
    expect(f).not.toHaveBeenCalled();
  });

  it("a legacy access token (no sid) is treated as signed out", async () => {
    const legacy = await access({ claims: { name: "J", roles: ["admin"] } });
    const res = await middleware(req("/dashboard", `${SESSION_COOKIE}=${legacy}`));
    expect(res.headers.get("location")).toBe("http://localhost:3000/login?next=%2Fdashboard");
  });
});
