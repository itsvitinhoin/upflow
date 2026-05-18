import * as Sentry from "@sentry/nextjs";
import { logError } from "@/lib/log-error";

/**
 * Thin wrapper over the error-tracking SDK so the rest of the app never
 * imports `@sentry/nextjs` directly. The wrapper is a no-op when
 * `SENTRY_DSN` is not configured (dev/CI without a key) so local
 * development keeps working without any external service.
 *
 * Sentry's own `init` is invoked in two bootstrap files which Next.js
 * picks up automatically:
 *  - `instrumentation.ts`     -> server / edge
 *  - `sentry.client.config.ts` -> browser
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
 * Capture an exception with structured context. Falls back to the
 * existing `logError` line so we always have a server-side trail even
 * when Sentry is off. Returns the Sentry event id when sent, or `null`.
 */
export function captureError(
  scope: string,
  error: unknown,
  context?: Record<string, unknown>,
): string | null {
  // Always log locally first — this is our breadcrumb of last resort
  // if the tracker swallows or drops the event.
  logError(scope, error, context);
  if (!initialized) return null;
  try {
    const eventId = Sentry.captureException(error, {
      tags: { scope },
      extra: scrub(context),
    });
    return eventId ?? null;
  } catch (err) {
    // Never let an error-tracker bug take down a request.
    logError("error-tracker:capture-failed", err, { originalScope: scope });
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
 * Sentry's API here (that would add latency to every health check) —
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
