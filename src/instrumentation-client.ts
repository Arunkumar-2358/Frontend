// Browser Sentry: only loaded when NEXT_PUBLIC_SENTRY_DSN is set at build time.
// The literal `process.env.NEXT_PUBLIC_…` check is inlined by Next, so without a DSN this is dead code.
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  void Promise.all([import("@sentry/nextjs"), import("@/lib/sentry")]).then(([Sentry, { sentryOptions }]) => {
    Sentry.init({ ...sentryOptions(dsn), replaysSessionSampleRate: 0, replaysOnErrorSampleRate: 0 });
  });
}
