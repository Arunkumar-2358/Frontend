import "server-only";
import { cookies, headers as requestHeaders } from "next/headers";
import { redirect } from "next/navigation";
import type { ApiErrorBody, ApiRoutes } from "@contracts";
import { SESSION_COOKIE } from "@/lib/auth-cookies";
import { ApiError } from "./errors";
import { parseJson } from "./json";

type Key = keyof ApiRoutes & string;
type Input<K extends Key> = Omit<ApiRoutes[K], "response">;
/**
 * token: use this bearer instead of the session cookie (a 401 then throws instead of redirecting).
 * auth: false sends no credentials (e.g. login). timeoutMs: abort the call after this long.
 */
type CallOpts = { token?: string; auth?: false; timeoutMs?: number };
/** The input argument is optional when the endpoint takes no params, query or body. */
type Args<K extends Key> = Partial<Record<string, never>> extends Input<K> ? [input?: Input<K> & CallOpts] : [input: Input<K> & CallOpts];

/** The browser's IP and user agent, forwarded so the API sees the real client behind this server. */
async function clientContext(): Promise<Record<string, string>> {
  try {
    const h = await requestHeaders();
    const out: Record<string, string> = {};
    for (const name of ["x-forwarded-for", "x-real-ip", "user-agent"]) {
      const v = h.get(name);
      if (v) out[name] = v;
    }
    return out;
  } catch {
    return {}; // outside a request (build time, scripts)
  }
}

const API_URL = (process.env.API_URL ?? "http://localhost:4000").replace(/\/$/, "");

function buildUrl(path: string, params?: Record<string, string>, query?: Record<string, unknown>) {
  const filled = path.replace(/\{(\w+)\}/g, (_, k: string) => {
    const v = params?.[k];
    if (v === undefined) throw new Error(`Missing path param "${k}" for ${path}`);
    return encodeURIComponent(v);
  });
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v === undefined || v === null || v === "") continue;
    for (const item of Array.isArray(v) ? v : [v]) qs.append(k, item instanceof Date ? item.toISOString() : String(item));
  }
  const q = qs.toString();
  return `${API_URL}${filled}${q ? `?${q}` : ""}`;
}

/**
 * Call the Recruit CRM API from a server component or server action.
 * The signed-in user's access token (nt_session cookie) is forwarded as a bearer token.
 * A 401 on a cookie-authenticated call sends the user back to the login page. Refreshing
 * happens only in middleware, before rendering — cookies are read-only in server components,
 * and a second refresh here would spend the single-use refresh token twice.
 */
export async function api<K extends Key>(key: K, ...[input]: Args<K>): Promise<ApiRoutes[K]["response"]> {
  const [method, path] = key.split(" ") as [string, string];
  const { params, query, body, token, auth, timeoutMs } = (input ?? {}) as { params?: Record<string, string>; query?: Record<string, unknown>; body?: unknown } & CallOpts;
  const bearer = auth === false ? undefined : (token ?? (await cookies()).get(SESSION_COOKIE)?.value);
  const isForm = body instanceof FormData;

  const res = await fetch(buildUrl(path, params, query), {
    method,
    headers: {
      accept: "application/json",
      // The API rate-limits and audits by client IP; without this every user would share the web server's IP.
      ...(await clientContext()),
      ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
      ...(body !== undefined && !isForm ? { "content-type": "application/json" } : {}),
    },
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    cache: "no-store",
    ...(timeoutMs ? { signal: AbortSignal.timeout(timeoutMs) } : {}),
  });

  const text = await res.text();
  if (res.ok) return (text ? parseJson(text) : undefined) as ApiRoutes[K]["response"];

  let err: ApiErrorBody["error"] = { code: "INTERNAL", message: `API ${method} ${path} failed with ${res.status}` };
  try {
    err = (JSON.parse(text) as ApiErrorBody).error ?? err;
  } catch {
    /* non-JSON error body */
  }
  if (res.status === 401 && bearer && !token) redirect("/login");
  throw new ApiError(res.status, err);
}
