import { NextResponse } from "next/server";
import { isWorkspaceAdmin } from "@/lib/auth-helpers";
import { requireAuth } from "@/lib/auth-response";
import { prisma } from "@/lib/prisma";
import { withErrorReporting } from "@/lib/with-error-reporting";

type HealthCheck = {
  ok: boolean;
  label: string;
  message: string;
};

async function GET_handler() {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;

  if (!isWorkspaceAdmin(auth) || !auth.currentWorkspaceId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const checks: Record<string, HealthCheck> = {
    database: await checkDatabase(),
    supabase: checkSupabase(),
    resend: checkResend(),
    app_url: checkAppUrl(),
    active_workspace: checkActiveWorkspace(auth.currentWorkspaceId, auth.currentRole),
    migration: await checkLatestMigration(),
  };
  const ready = Object.values(checks).every((check) => check.ok);

  return NextResponse.json({
    status: ready ? "ok" : "degraded",
    checked_at: new Date().toISOString(),
    workspace_id: auth.currentWorkspaceId,
    checks,
  });
}

async function checkDatabase(): Promise<HealthCheck> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      ok: true,
      label: "Database reachable",
      message: "Postgres accepted a read query.",
    };
  } catch {
    return {
      ok: false,
      label: "Database unreachable",
      message: "Check DATABASE_URL, DIRECT_URL, Supabase status, and migrations.",
    };
  }
}

function checkSupabase(): HealthCheck {
  const missing = [
    !process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && "NEXT_PUBLIC_SUPABASE_URL",
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() && "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() && "SUPABASE_SERVICE_ROLE_KEY",
  ].filter(Boolean);
  return {
    ok: missing.length === 0,
    label: missing.length === 0 ? "Supabase configured" : "Supabase config missing",
    message:
      missing.length === 0
        ? "Auth and invite account creation settings are present."
        : `Missing ${missing.join(", ")}.`,
  };
}

function checkResend(): HealthCheck {
  const missing = [
    !process.env.RESEND_API_KEY?.trim() && "RESEND_API_KEY",
    !process.env.EMAIL_FROM?.trim() && "EMAIL_FROM",
  ].filter(Boolean);
  const defaultSender = process.env.EMAIL_FROM?.trim() === "Up Flow <onboarding@resend.dev>";
  return {
    ok: missing.length === 0 && !defaultSender,
    label: missing.length === 0 && !defaultSender ? "Resend configured" : "Email setup needs attention",
    message:
      missing.length > 0
        ? `Missing ${missing.join(", ")}.`
        : defaultSender
          ? "EMAIL_FROM is still using the Resend development sender."
          : "Invite email settings are present.",
  };
}

function checkAppUrl(): HealthCheck {
  const appUrl = process.env.APP_URL?.trim();
  return {
    ok: Boolean(appUrl),
    label: appUrl ? "APP_URL configured" : "APP_URL missing",
    message: appUrl
      ? "Invite links will use the configured public URL."
      : "Set APP_URL to the canonical production URL.",
  };
}

function checkActiveWorkspace(workspaceId: string, role: string | null): HealthCheck {
  return {
    ok: Boolean(workspaceId && role),
    label: workspaceId && role ? "Active workspace valid" : "Active workspace invalid",
    message: workspaceId && role
      ? `Current role: ${role}.`
      : "Select a valid workspace or repair workspace membership.",
  };
}

async function checkLatestMigration(): Promise<HealthCheck> {
  try {
    const rows = await prisma.$queryRaw<Array<{ migration_name: string }>>`
      SELECT migration_name
      FROM "_prisma_migrations"
      WHERE finished_at IS NOT NULL
      ORDER BY finished_at DESC
      LIMIT 1
    `;
    const latest = rows[0]?.migration_name;
    return {
      ok: Boolean(latest),
      label: latest ? "Migration history readable" : "No applied migrations found",
      message: latest ? `Latest applied migration: ${latest}.` : "Run Prisma migrations for this database.",
    };
  } catch {
    return {
      ok: false,
      label: "Migration history unavailable",
      message: "Could not read Prisma migration history.",
    };
  }
}

export const GET = withErrorReporting("api:admin/health:GET", GET_handler);
