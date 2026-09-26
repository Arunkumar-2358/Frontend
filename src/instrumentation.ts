/**
 * Error monitoring hook. Logs every server error with route context; if
 * ERROR_WEBHOOK_URL is set (e.g. a Slack/Sentry-compatible collector), posts it there too.
 * If SENTRY_DSN is set, errors also go to Sentry (PII-scrubbed, see src/lib/sentry.ts).
 */
import type { Instrumentation } from "next";

let sentry: typeof import("@sentry/nextjs") | null = null;

export async function register() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  if (process.env.NEXT_RUNTIME !== "nodejs" && process.env.NEXT_RUNTIME !== "edge") return;
  try {
    const [Sentry, { sentryOptions }] = await Promise.all([import("@sentry/nextjs"), import("@/lib/sentry")]);
    Sentry.init(sentryOptions(dsn));
    sentry = Sentry;
  } catch (e) {
    console.error("[sentry] init failed; continuing without it", e instanceof Error ? e.message : e);
  }
}

export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const e = err as Error & { digest?: string };
  const payload = {
    at: new Date().toISOString(),
    message: e.message,
    digest: e.digest,
    stack: e.stack?.split("\n").slice(0, 8).join("\n"),
    path: request.path,
    method: request.method,
    routerKind: context.routerKind,
    routeType: context.routeType,
  };
  console.error("[error]", JSON.stringify(payload));
  if (sentry) {
    try {
      // Strip the query from the path and send no headers; beforeSend scrubs the rest.
      sentry.captureRequestError(err, { ...request, path: request.path.split("?")[0], headers: {} }, context);
    } catch {
      /* never throw from the error hook */
    }
  }
  const url = process.env.ERROR_WEBHOOK_URL;
  if (url) {
    try {
      await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: `CRM error on ${payload.method} ${payload.path}: ${payload.message}`, ...payload }) });
    } catch {
      /* never throw from the error hook */
    }
  }
};
