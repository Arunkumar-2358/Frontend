/**
 * Error monitoring hook. Logs every server error with route context; if
 * ERROR_WEBHOOK_URL is set (e.g. a Slack/Sentry-compatible collector), posts it there too.
 */
import type { Instrumentation } from "next";

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
  const url = process.env.ERROR_WEBHOOK_URL;
  if (url) {
    try {
      await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: `CRM error on ${payload.method} ${payload.path}: ${payload.message}`, ...payload }) });
    } catch {
      /* never throw from the error hook */
    }
  }
};
