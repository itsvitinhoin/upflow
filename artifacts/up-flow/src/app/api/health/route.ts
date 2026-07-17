import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateEnv } from "@/lib/env";
import {
  databaseErrorCode,
  databaseErrorKind,
  hasInternalHealthAccess,
} from "@/lib/health-diagnostics";
import { logError } from "@/lib/log-error";
import { pingRateLimiter } from "@/lib/rate-limit";
import { pingBrowserTracker, pingTracker } from "@/lib/error-tracker";
import { withErrorReporting } from "@/lib/with-error-reporting";

export const dynamic = "force-dynamic";

async function getHandler(req: NextRequest) {
  const env = validateEnv();
  const internal = hasInternalHealthAccess(
    req.headers.get("authorization"),
    process.env.CRON_SECRET,
  );
  let db: "ok" | "error" = "ok";
  let dbErrorCode: string | undefined;
  let dbErrorKind: ReturnType<typeof databaseErrorKind> | undefined;
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    // Log full diagnostics server-side; do NOT leak details over the wire.
    logError("health:db", err);
    db = "error";
    dbErrorCode = databaseErrorCode(err);
    dbErrorKind = databaseErrorKind(err);
  }
  if (!env.ok) {
    logError("health:env", new Error("missing env vars"), { missing: env.missing });
  }

  const rl = await pingRateLimiter();
  if (!rl.ok) {
    logError("health:rate-limit", new Error(rl.error ?? "redis unreachable"));
  }

  const tracker = pingTracker();
  const browserTracker = pingBrowserTracker();
  // Surface a misconfigured tracker (DSN set but SDK never initialized,
  // typically a build/instrumentation regression) as a server-side log.
  if (tracker.configured && !tracker.initialized) {
    logError(
      "health:error-tracker",
      new Error("SENTRY_DSN set but SDK not initialized"),
    );
  }
  if (process.env.NODE_ENV === "production" && !browserTracker.configured) {
    logError(
      "health:browser-error-tracker",
      new Error("NEXT_PUBLIC_SENTRY_DSN is not configured"),
    );
  }

  const production = process.env.NODE_ENV === "production";
  const serverObservabilityReady =
    !production || (tracker.configured && tracker.initialized);
  const browserObservabilityReady = !production || browserTracker.configured;
  const ok =
    env.ok &&
    db === "ok" &&
    rl.ok &&
    serverObservabilityReady &&
    browserObservabilityReady;
  return NextResponse.json(
    {
      status: ok ? "ok" : "degraded",
      uptime_s: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      rate_limit: {
        configured: rl.configured,
        ok: rl.ok,
        backend: rl.backend,
        required: rl.required,
        ...(rl.error ? { error: "unavailable" } : {}),
      },
      error_tracker: {
        server: {
          configured: tracker.configured,
          initialized: tracker.initialized,
          release: tracker.release,
        },
        browser: browserTracker,
      },
      ...(internal
        ? {
            diagnostics: {
              environment: { ok: env.ok, missing: env.missing },
              database: {
                ok: db === "ok",
                ...(dbErrorCode ? { error_code: dbErrorCode } : {}),
                ...(dbErrorKind ? { error_kind: dbErrorKind } : {}),
              },
            },
          }
        : {}),
    },
    { status: ok ? 200 : 503 },
  );
}

export const GET = withErrorReporting("api:health:GET", getHandler);
