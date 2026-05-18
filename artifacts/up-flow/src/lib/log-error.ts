/**
 * Standardized error logger. All catch blocks that don't surface to the user
 * via toast should call this so logs share a single grep-able shape AND
 * automatically reach the error-tracking service (when configured).
 *
 *   logError("api:tasks:POST", err, { project_id })
 *
 * Output line shape:
 *   [upflow] api:tasks:POST  Error: <message>  {context...}
 *
 * When the Sentry SDK has been initialized (SENTRY_DSN configured + the
 * server `register()` ran), the same error is also forwarded to the
 * tracker with the scope as a tag and the context as `extra`. This means
 * every existing `logError(...)` site automatically gets stack traces in
 * the on-call dashboard without needing a per-call refactor.
 */
export function logError(
  scope: string,
  error: unknown,
  context?: Record<string, unknown>,
): void {
  const message =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : typeof error === "string"
        ? error
        : (() => {
            try {
              return JSON.stringify(error);
            } catch {
              return String(error);
            }
          })();
  const stack = error instanceof Error ? error.stack : undefined;
  const ctx = context && Object.keys(context).length > 0 ? context : undefined;
  // Use a single console.error call so log shippers keep the entry together.
  if (stack) {
    console.error(`[upflow] ${scope}`, message, ctx ?? "", "\n", stack);
  } else {
    console.error(`[upflow] ${scope}`, message, ctx ?? "");
  }
  // Forward to the error tracker (no-op when DSN unset or SDK not loaded).
  // Lazy require avoids a circular import between log-error and error-tracker
  // and keeps the tracker SDK out of bundles that don't need it.
  try {
    forwardToTracker(scope, error, ctx);
  } catch {
    // never let the tracker take down a logging path
  }
}

let trackerSendRef: null | ((scope: string, err: unknown, ctx?: Record<string, unknown>) => void) = null;
function forwardToTracker(
  scope: string,
  error: unknown,
  ctx?: Record<string, unknown>,
): void {
  if (!trackerSendRef) {
    // Bind lazily so SSR / edge bundles that never hit an error path
    // don't pull in the Sentry client.
    const mod: typeof import("@/lib/error-tracker") = require("@/lib/error-tracker");
    trackerSendRef = mod.sendToTracker;
  }
  trackerSendRef(scope, error, ctx);
}
