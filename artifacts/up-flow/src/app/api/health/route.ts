import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateEnv } from "@/lib/env";
import { logError } from "@/lib/log-error";
import { pingRateLimiter } from "@/lib/rate-limit";
import { pingTracker } from "@/lib/error-tracker";

export const dynamic = "force-dynamic";

export async function GET() {
  const env = validateEnv();
  let db: "ok" | "error" = "ok";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    // Log full diagnostics server-side; do NOT leak details over the wire.
    logError("health:db", err);
    db = "error";
  }
  if (!env.ok) {
    logError("health:env", new Error("missing env vars"), { missing: env.missing });
  }

  const rl = await pingRateLimiter();
  if (rl.configured && !rl.ok) {
    logError("health:rate-limit", new Error(rl.error ?? "redis unreachable"));
  }

  const tracker = pingTracker();
  // Surface a misconfigured tracker (DSN set but SDK never initialized,
  // typically a build/instrumentation regression) as a server-side log.
  // Does NOT flip overall status — observability outage shouldn't take
  // the app down.
  if (tracker.configured && !tracker.initialized) {
    logError(
      "health:error-tracker",
      new Error("SENTRY_DSN set but SDK not initialized"),
    );
  }

  // Rate-limit connectivity is reported but does NOT flip overall status to
  // degraded — we fail-open by design, so a Redis blip shouldn't make
  // health-checks fail and recycle the container.
  const ok = env.ok && db === "ok";
  return NextResponse.json(
    {
      status: ok ? "ok" : "degraded",
      uptime_s: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      rate_limit: {
        configured: rl.configured,
        ok: rl.ok,
        backend: rl.backend,
      },
      error_tracker: {
        configured: tracker.configured,
        initialized: tracker.initialized,
        release: tracker.release,
      },
    },
    { status: ok ? 200 : 503 },
  );
}
