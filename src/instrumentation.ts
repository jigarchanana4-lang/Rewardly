/**
 * Optional error monitoring. Initializes Sentry only when SENTRY_DSN is set
 * and the package is installed — so it's a no-op until you opt in:
 *   npm i @sentry/nextjs   (then set SENTRY_DSN)
 */
export async function register() {
  if (!process.env.SENTRY_DSN) return;
  try {
    const pkg = "@sentry/nextjs";
    const Sentry = (await import(/* webpackIgnore: true */ pkg)) as {
      init: (o: Record<string, unknown>) => void;
    };
    Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0.1 });
  } catch {
    // package not installed — skip silently
  }
}
