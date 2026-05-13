import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const env = validateEnv();
  let db: "ok" | "error" = "ok";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    // Log full diagnostics server-side; do NOT leak details over the wire.
    console.error("[health] db check failed", err);
    db = "error";
  }
  if (!env.ok) {
    console.error("[health] missing env vars", env.missing);
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
