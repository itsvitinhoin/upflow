import { NextResponse } from "next/server";
import { captureError } from "@/lib/error-tracker";

/**
 * Wrap an API route handler so any thrown exception is captured by the
 * error tracker, and any 5xx response is treated as a real incident.
 * Client-error (4xx) responses are deliberately NOT reported — those are
 * user/validation paths and we don't want to flood the on-call channel
 * with "user typed a bad email" noise.
 *
 *   export const POST = withErrorReporting("api:tasks:POST", async (req) => { ... });
 *
 * The wrapper returns a normal 500 JSON response if the handler throws,
 * so the route still behaves correctly even when the tracker is off.
 */
export function withErrorReporting<
  // Preserve the handler's exact arg tuple so Next.js still sees the
  // correct (req, ctx?) signature on the export.
  A extends unknown[],
  R extends Response,
>(
  scope: string,
  handler: (...args: A) => Promise<R> | R,
): (...args: A) => Promise<Response> {
  return async (...args: A) => {
    try {
      const res = await handler(...args);
      // 5xx from a handler that returned normally (e.g. caught DB error and
      // returned NextResponse.json({...}, {status: 503})). We still want
      // visibility into these.
      if (res && res.status >= 500) {
        // The handler caught its own error and returned a 5xx without
        // throwing. The *real* exception was already sent to the tracker
        // by the inner `logError(...)` call (see lib/log-error.ts), so
        // we only emit a low-severity marker here for incident counting.
        // We tag it `synthetic` so on-call can filter it out and see the
        // root-cause event instead.
        captureError(
          scope,
          new Error(`${scope} responded ${res.status}`),
          { kind: "5xx-response-marker", status: res.status, synthetic: true },
        );
      }
      return res;
    } catch (err) {
      captureError(scope, err, { kind: "uncaught" });
      // Don't leak the error message to the wire — keep the standard
      // generic 500 shape the existing endpoints use.
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
  };
}
