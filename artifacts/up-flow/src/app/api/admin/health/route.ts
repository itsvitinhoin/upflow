import { NextResponse } from "next/server";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { isWorkspaceAdmin } from "@/lib/auth-helpers";
import { requireAuth } from "@/lib/auth-response";
import { prisma } from "@/lib/prisma";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { withErrorReporting } from "@/lib/with-error-reporting";

type HealthCheck = {
  ok: boolean;
  label: string;
  message: string;
};

type ReadinessStep = {
  title: string;
  detail: string;
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
    database_urls: checkDatabaseUrls(),
    supabase: checkSupabase(),
    storage: await checkStorage(),
    resend: checkResend(),
    app_url: checkAppUrl(),
    active_workspace: checkActiveWorkspace(auth.currentWorkspaceId, auth.currentRole),
    migration: await checkLatestMigration(),
  };
  const ready = Object.values(checks).every((check) => check.ok);

  return NextResponse.json({
    status: ready ? "ok" : "degraded",
    ready,
    checked_at: new Date().toISOString(),
    workspace_id: auth.currentWorkspaceId,
    checks,
    rollout_steps: buildRolloutSteps(),
  });
}

async function checkStorage(): Promise<HealthCheck> {
  const bucket = process.env.TASK_ASSETS_BUCKET || "task-assets";
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  ) {
    return {
      ok: false,
      label: "Task image storage not ready",
      message: "Supabase URL and service role key are required before checking Storage.",
    };
  }
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.storage.getBucket(bucket);
    if (error) {
      return {
        ok: false,
        label: "Task image storage bucket missing",
        message: `Create a public Supabase Storage bucket named "${bucket}" or set TASK_ASSETS_BUCKET to the configured bucket.`,
      };
    }
    if (data && "public" in data && !data.public) {
      return {
        ok: false,
        label: "Task image storage bucket private",
        message: `Make Supabase Storage bucket "${bucket}" public so task cover images can render in board cards.`,
      };
    }
    return {
      ok: true,
      label: "Task image storage ready",
      message: `Supabase Storage bucket "${bucket}" is reachable for task cover uploads.`,
    };
  } catch {
    return {
      ok: false,
      label: "Task image storage unavailable",
      message: "Could not verify Supabase Storage. Check service role key and bucket permissions.",
    };
  }
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

function checkDatabaseUrls(): HealthCheck {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const directUrl = process.env.DIRECT_URL?.trim();
  const missing = [
    !databaseUrl && "DATABASE_URL",
    !directUrl && "DIRECT_URL",
  ].filter(Boolean);
  const placeholders = [databaseUrl, directUrl].some((value) =>
    value?.includes("[YOUR-PASSWORD]"),
  );
  const invalidDirectUrl = Boolean(directUrl && !/^postgres(?:ql)?:\/\//.test(directUrl));
  const invalidDatabaseUrl = Boolean(databaseUrl && !/^postgres(?:ql)?:\/\//.test(databaseUrl));

  if (missing.length > 0) {
    return {
      ok: false,
      label: "Database URLs incomplete",
      message: `Missing ${missing.join(", ")}. DATABASE_URL is used by the app; DIRECT_URL is required for Prisma migrations.`,
    };
  }
  if (placeholders) {
    return {
      ok: false,
      label: "Database URL still has placeholder",
      message: "Replace [YOUR-PASSWORD] with the real Supabase database password before deploying.",
    };
  }
  if (invalidDatabaseUrl || invalidDirectUrl) {
    return {
      ok: false,
      label: "Database URL format invalid",
      message: "DATABASE_URL and DIRECT_URL must be Postgres connection strings, not the Supabase project HTTPS URL.",
    };
  }

  return {
    ok: true,
    label: "Database URLs configured",
    message: "DATABASE_URL and DIRECT_URL are present and use Postgres connection-string format.",
  };
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
  let valid = Boolean(appUrl);
  let message = appUrl
    ? "Invite links will use the configured public URL."
    : "Set APP_URL to the canonical production URL.";

  if (appUrl) {
    try {
      const parsed = new URL(appUrl);
      if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
        valid = false;
        message = "Production APP_URL must use HTTPS.";
      }
    } catch {
      valid = false;
      message = "APP_URL must be a valid absolute URL, for example https://upflow-mocha.vercel.app.";
    }
  }

  return {
    ok: valid,
    label: valid ? "APP_URL configured" : "APP_URL needs attention",
    message,
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
    const expected = getLatestBundledMigration();
    if (latest && expected && latest !== expected) {
      return {
        ok: false,
        label: "Production migrations behind",
        message: `Database latest migration is ${latest}; app bundle expects ${expected}. Run npm run db:migrate:deploy before redeploying.`,
      };
    }
    return {
      ok: Boolean(latest),
      label: latest ? "Latest migration applied" : "No applied migrations found",
      message: latest
        ? expected
          ? `Database is on latest bundled migration: ${latest}.`
          : `Latest applied migration: ${latest}.`
        : "Run Prisma migrations for this database.",
    };
  } catch {
    return {
      ok: false,
      label: "Migration history unavailable",
      message: "Could not read Prisma migration history.",
    };
  }
}

function getLatestBundledMigration(): string | null {
  try {
    const migrationsDir = join(process.cwd(), "prisma", "migrations");
    if (!existsSync(migrationsDir)) return null;
    const migrations = readdirSync(migrationsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) => /^\d{14}_/.test(name))
      .sort();
    return migrations.at(-1) ?? null;
  } catch {
    return null;
  }
}

function buildRolloutSteps(): ReadinessStep[] {
  return [
    {
      title: "Run migrations before redeploy",
      detail: "Use npm run db:migrate:deploy against production, then redeploy the Vercel project.",
    },
    {
      title: "Verify core flows",
      detail: "Create a space, folder, list, task with a cover image, client, meeting, invite, and time entry in production.",
    },
    {
      title: "Pilot with real users",
      detail: "Invite one user from each department, confirm notifications, and keep the old system read-only during the pilot.",
    },
  ];
}

export const GET = withErrorReporting("api:admin/health:GET", GET_handler);
