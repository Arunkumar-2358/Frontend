import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ApiErrorBody, ApiRoutes } from "@contracts";
import { SESSION_COOKIE } from "@/lib/session-token";
import { ApiError } from "./errors";

type Key = keyof ApiRoutes & string;
type Input<K extends Key> = Omit<ApiRoutes[K], "response">;
/** token: use this bearer instead of the session cookie. auth: false sends no credentials (e.g. login). */
type CallOpts = { token?: string; auth?: false };
type Args<K extends Key> = {} extends Input<K> ? [input?: Input<K> & CallOpts] : [input: Input<K> & CallOpts];

const API_URL = (process.env.API_URL ?? "http://localhost:4000").replace(/\/$/, "");
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

/** JSON.parse that turns ISO-8601 UTC timestamps back into Date objects. */
export const parseJson = (text: string) => JSON.parse(text, (_k, v) => (typeof v === "string" && ISO_DATE.test(v) ? new Date(v) : v));

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
 * The signed-in user's session token is forwarded as a bearer token.
 * A 401 sends the user back to the login page.
 */
export async function api<K extends Key>(key: K, ...[input]: Args<K>): Promise<ApiRoutes[K]["response"]> {
  const [method, path] = key.split(" ") as [string, string];
  const { params, query, body, token, auth } = (input ?? {}) as { params?: Record<string, string>; query?: Record<string, unknown>; body?: unknown } & CallOpts;
  const bearer = auth === false ? undefined : (token ?? (await cookies()).get(SESSION_COOKIE)?.value);
  const isForm = body instanceof FormData;

  const res = await fetch(buildUrl(path, params, query), {
    method,
    headers: {
      accept: "application/json",
      ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
      ...(body !== undefined && !isForm ? { "content-type": "application/json" } : {}),
    },
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    cache: "no-store",
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
