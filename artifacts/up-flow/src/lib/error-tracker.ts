import * as Sentry from "@sentry/nextjs";

/**
 * Thin wrapper over the error-tracking SDK so the rest of the app never
 * imports `@sentry/nextjs` directly. The wrapper is a no-op when
 * `SENTRY_DSN` is not configured (dev/CI without a key) so local
 * development keeps working without any external service.
 *
 * Init is performed in two bootstrap files Next.js picks up automatically:
 *  - `src/instrumentation.ts`     -> server / edge
 *  - `sentry.client.config.ts`    -> browser
 *
 * Error capture is funneled through `logError()` (see `log-error.ts`),
 * which forwards here via `sendToTracker()` when initialized. That means
 * every existing `logError(...)` call site automatically reaches Sentry
 * with full stack + context - no per-call refactor required.
 */

let initialized = false;

export function markInitialized(): void {
  initialized = true;
}

/** True when the tracker SDK has been initialized this process. */
export function isTrackerConfigured(): boolean {
  return Boolean(process.env.SENTRY_DSN);
}

export function isTrackerInitialized(): boolean {
  return initialized;
}

/**
 * Used by `logError()` to forward every server-side error to Sentry.
 * Returns silently when the SDK isn't initialized.
 */
export function sendToTracker(
  scope: string,
  error: unknown,
  context?: Record<string, unknown>,
): string | null {
  if (!initialized) return null;
  try {
    const eventId = Sentry.captureException(error, {
      tags: { scope },
      extra: scrub(context),
    });
    return eventId ?? null;
  } catch {
    // Never let an error-tracker bug take down a request or a log call.
    return null;
  }
}

/**
 * Public capture API - used by `withErrorReporting` and any code path
 * that wants to *force* an out-of-band tracker hit (e.g. the React
 * error boundary on mount). For normal server catch blocks, just call
 * `logError(...)` instead - it forwards here automatically.
 */
export function captureError(
  scope: string,
  error: unknown,
  context?: Record<string, unknown>,
): string | null {
  // Delegate to `logError` so we get the local breadcrumb + tracker hit
  // in a single call. `logError` lazy-requires `sendToTracker` which is
  // safe (no recursion: `logError` does not call `captureError`).
  const { logError }: typeof import("@/lib/log-error") = require("@/lib/log-error");
  logError(scope, error, context);
  // Return the event id from the most-recent send if available. Sentry's
  // last-event id is the right one because logError just called sendToTracker.
  if (!initialized) return null;
  try {
    return Sentry.lastEventId() ?? null;
  } catch {
    return null;
  }
}

/**
 * Set request-scoped user/workspace context so any later capture in the
 * same request includes it. Strips PII (no email).
 */
export function setRequestContext(ctx: {
  userId?: string;
  workspaceId?: string;
  route?: string;
}): void {
  if (!initialized) return;
  try {
    Sentry.getCurrentScope().setUser({ id: ctx.userId ?? undefined });
    if (ctx.workspaceId) {
      Sentry.getCurrentScope().setTag("workspaceId", ctx.workspaceId);
    }
    if (ctx.route) {
      Sentry.getCurrentScope().setTag("route", ctx.route);
    }
  } catch {
    // ignore
  }
}

/**
 * Health probe used by `/api/health`. We don't actually round-trip to
 * Sentry's API here (that would add latency to every health check) -
 * we just report whether the SDK is configured and initialized.
 */
export function pingTracker(): {
  configured: boolean;
  initialized: boolean;
  release: string | null;
} {
  return {
    configured: isTrackerConfigured(),
    initialized,
    release: process.env.SENTRY_RELEASE ?? null,
  };
}

/**
 * Strip obvious secret-shaped keys before sending. Sentry's own
 * `beforeSend` (configured in init) handles the deep redaction; this is
 * a defense-in-depth pass on the explicit `extra` payloads we add.
 */
const SECRET_KEY = /(?:authorization|cookie|password|token|api[_-]?key|secret|dsn)/i;
function scrub(input?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!input) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (SECRET_KEY.test(k)) {
      out[k] = "[redacted]";
      continue;
    }
    out[k] = v;
  }
  return out;
}
