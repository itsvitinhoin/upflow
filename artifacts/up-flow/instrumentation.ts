/**
 * Next.js calls `register()` once per server process (Node + edge runtimes)
 * before any request runs. We use it to bootstrap Sentry server-side, but
 * gracefully no-op when SENTRY_DSN is missing so local dev / CI keep
 * working without an external key.
 */
export async function register() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  const Sentry = await import("@sentry/nextjs");
  const { markInitialized } = await import("@/lib/error-tracker");

  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init({
      dsn,
      release: process.env.SENTRY_RELEASE,
      environment: process.env.NODE_ENV,
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
      // PII off by default. We attach user.id explicitly via setRequestContext.
      sendDefaultPii: false,
      beforeSend(event) {
        return redactSensitive(event);
      },
    });
    markInitialized();
  } else if (process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn,
      release: process.env.SENTRY_RELEASE,
      environment: process.env.NODE_ENV,
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
      sendDefaultPii: false,
      beforeSend(event) {
        return redactSensitive(event);
      },
    });
    markInitialized();
  }
}

// Server-side `beforeSend` hook: strip cookies/auth headers and emails from
// every outbound event. Sentry's defaults don't redact our auth cookies.
function redactSensitive<T extends { request?: { headers?: Record<string, string>; cookies?: Record<string, string> }; user?: { email?: string | null; ip_address?: string | null } }>(
  event: T,
): T {
  if (event.request) {
    if (event.request.headers) {
      for (const k of Object.keys(event.request.headers)) {
        if (/^(authorization|cookie|x-.*-token)$/i.test(k)) {
          event.request.headers[k] = "[redacted]";
        }
      }
    }
    if (event.request.cookies) {
      event.request.cookies = { redacted: "[redacted]" };
    }
  }
  if (event.user) {
    delete event.user.email;
    event.user.ip_address = null;
  }
  return event;
}
