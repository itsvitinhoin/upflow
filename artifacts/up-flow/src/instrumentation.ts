/**
 * Next.js calls `register()` once per server process (Node + edge runtimes)
 * before any request runs. Two responsibilities live here:
 *  1. Validate required env vars so production boot aborts loudly on a
 *     missing config rather than failing on the first request.
 *  2. Bootstrap Sentry server-side (no-op when SENTRY_DSN is unset, so
 *     local dev / CI keep working without an external key).
 *
 * IMPORTANT: with the `src/` layout, Next.js picks up `src/instrumentation.ts`
 * over a root-level one — do not split this into two files.
 */
export async function register() {
  // Env validation first so a misconfig fails before we wire anything else.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("@/lib/env");
  }

  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  const Sentry = await import("@sentry/nextjs");
  const { markInitialized } = await import("@/lib/error-tracker");

  const common = {
    dsn,
    release: process.env.SENTRY_RELEASE,
    environment: process.env.NODE_ENV,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
    // PII off by default; we attach user.id explicitly via setRequestContext().
    sendDefaultPii: false,
    beforeSend: redactSensitive,
  } as const;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init(common);
    markInitialized();
  } else if (process.env.NEXT_RUNTIME === "edge") {
    Sentry.init(common);
    markInitialized();
  }
}

// `beforeSend`: strip cookies/auth headers and emails from every event.
// Sentry's defaults do not redact our session cookies.
function redactSensitive<
  T extends {
    request?: {
      headers?: Record<string, string>;
      cookies?: Record<string, string>;
    };
    user?: { email?: string | null; ip_address?: string | null };
  },
>(event: T): T {
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
