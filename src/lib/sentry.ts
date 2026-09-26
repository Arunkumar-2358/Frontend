/**
 * Sentry — optional and PII-scrubbed. Everything here is a no-op unless a DSN is set:
 *   SENTRY_DSN               server + edge (read at runtime)
 *   NEXT_PUBLIC_SENTRY_DSN   browser (inlined at build time)
 * No build plugin / source-map upload, so builds need no Sentry auth token.
 *
 * Healthcare CRM data (candidate names, mobiles, emails) must never leave in an event:
 * no request bodies, cookies, headers or query strings; no user fields beyond an id;
 * breadcrumb URLs lose their query too.
 */
import type { Breadcrumb, ErrorEvent, Event } from "@sentry/nextjs";
import { maskPii, maskPiiDeep } from "./pii-scrub";

/** Drop the query string and fragment from a URL or path (keeps it relative if it was). */
export function stripQuery(url: unknown): unknown {
  if (typeof url !== "string") return url;
  const i = url.search(/[?#]/);
  return i === -1 ? url : url.slice(0, i);
}

const URL_KEYS = ["url", "to", "from"] as const;

export function scrubEvent<T extends Event>(event: T): T {
  if (event.request) {
    const r = event.request;
    delete r.cookies;
    delete r.data;
    delete r.headers;
    delete r.query_string;
    delete r.env;
    r.url = maskPiiDeep(stripQuery(r.url)) as string | undefined;
  }
  if (event.user) event.user = event.user.id ? { id: event.user.id } : {};
  if (event.breadcrumbs) event.breadcrumbs = event.breadcrumbs.map(scrubBreadcrumb).filter((b): b is Breadcrumb => b !== null);
  if (typeof event.transaction === "string") event.transaction = maskPii(stripQuery(event.transaction) as string);
  // Error text can quote input ("Invalid mobile 98…", an API message with an email): mask it everywhere.
  if (event.message) event.message = maskPii(event.message);
  for (const ex of event.exception?.values ?? []) if (ex.value) ex.value = maskPii(ex.value);
  if (event.extra) event.extra = maskPiiDeep(event.extra);
  if (event.tags) event.tags = maskPiiDeep(event.tags);
  // Keep only runtime/browser/os contexts; anything app-supplied could carry records.
  if (event.contexts) event.contexts = Object.fromEntries(Object.entries(event.contexts).filter(([k]) => ["runtime", "browser", "os", "device", "trace"].includes(k)));
  return event;
}

export function scrubBreadcrumb(b: Breadcrumb): Breadcrumb | null {
  if (b.message) b.message = maskPii(b.message);
  if (b.data) {
    const data: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(b.data)) {
      if (/body|header|cookie|authorization|password|token/i.test(k)) continue;
      // URL paths can embed contact details too (/search/priya@…): strip the query, then mask.
      data[k] = maskPiiDeep((URL_KEYS as readonly string[]).includes(k) ? stripQuery(v) : v);
    }
    b.data = data;
  }
  // Console breadcrumbs can carry arbitrary objects (form values, API payloads).
  if (b.category === "console") return null;
  return b;
}

/** Options shared by the browser, Node and edge SDKs. */
export function sentryOptions(dsn: string) {
  const rate = Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? 0);
  return {
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    sendDefaultPii: false,
    tracesSampleRate: Number.isFinite(rate) ? rate : 0,
    beforeSend: (e: ErrorEvent) => scrubEvent(e),
    beforeSendTransaction: <T extends Event>(e: T) => scrubEvent(e),
    beforeBreadcrumb: (b: Breadcrumb) => scrubBreadcrumb(b),
  };
}
