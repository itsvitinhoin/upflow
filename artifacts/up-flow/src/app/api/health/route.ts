import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateEnv } from "@/lib/env";
import { logError } from "@/lib/log-error";

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

  const ok = env.ok && db === "ok";
  return NextResponse.json(
    {
      status: ok ? "ok" : "degraded",
      uptime_s: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 }
  );
}
