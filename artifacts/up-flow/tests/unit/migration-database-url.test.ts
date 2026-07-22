import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import test from "node:test";

const require = createRequire(import.meta.url);
const { getMigrationDatabaseUrl } = require("../../scripts/migration-database-url.cjs") as {
  getMigrationDatabaseUrl: (databaseUrl: string | undefined) => string | undefined;
};
const { getVerificationEnvironment, shouldVerifyMigrationState } = require("../../scripts/verify-migration-state.cjs") as {
  getVerificationEnvironment: (env: Record<string, string | undefined>) => Record<string, string | undefined>;
  shouldVerifyMigrationState: (env: Record<string, string | undefined>) => boolean;
};
const { canProceedWithPendingMigrations } = require("../../scripts/preflight-migrations.cjs") as {
  canProceedWithPendingMigrations: (output: string) => boolean;
};

const migrationDeployScript = readFileSync(
  new URL("../../scripts/deploy-migrations.cjs", import.meta.url),
  "utf8",
);
const packageJson = readFileSync(new URL("../../package.json", import.meta.url), "utf8");
const migrationPreflightScript = readFileSync(
  new URL("../../scripts/verify-migration-state.cjs", import.meta.url),
  "utf8",
);
const releaseMigrationPreflightScript = readFileSync(
  new URL("../../scripts/preflight-migrations.cjs", import.meta.url),
  "utf8",
);
const productionReleaseWorkflow = readFileSync(
  new URL("../../../../.github/workflows/release-production.yml", import.meta.url),
  "utf8",
);

test("uses the Supabase session pooler for Prisma migrations", () => {
  const applicationUrl =
    "postgresql://postgres.project:example@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=require";

  const migrationUrl = new URL(getMigrationDatabaseUrl(applicationUrl)!);

  assert.equal(migrationUrl.port, "5432");
  assert.equal(migrationUrl.searchParams.has("pgbouncer"), false);
  assert.equal(migrationUrl.searchParams.get("connection_limit"), "1");
  assert.equal(migrationUrl.searchParams.get("sslmode"), "require");
});

test("does not rewrite non-Supabase database URLs", () => {
  const databaseUrl = "postgresql://user:example@database.internal:6543/app?pgbouncer=true";
  assert.equal(getMigrationDatabaseUrl(databaseUrl), databaseUrl);
});

test("leaves missing or malformed database URLs unchanged", () => {
  assert.equal(getMigrationDatabaseUrl(undefined), undefined);
  assert.equal(getMigrationDatabaseUrl("not-a-database-url"), "not-a-database-url");
});

test("migrations cannot run from an application build or Vercel", () => {
  assert.match(migrationDeployScript, /invokedFromBuild \|\| process\.env\.VERCEL === "1"/);
  assert.match(migrationDeployScript, /Refusing to run Prisma migrations/);
  assert.doesNotMatch(migrationDeployScript, /RUN_PRISMA_MIGRATIONS/);
  assert.doesNotMatch(packageJson, /"build": "node scripts\/deploy-migrations\.cjs/);
});

test("Vercel builds verify migration state without applying migrations", () => {
  assert.equal(shouldVerifyMigrationState({ VERCEL: "1" }), true);
  assert.equal(shouldVerifyMigrationState({}), false);
  assert.match(packageJson, /"build": "prisma generate && node scripts\/verify-migration-state\.cjs && next build"/);
  assert.match(migrationPreflightScript, /prismaCommand, \["migrate", "status"\]/);
  assert.match(migrationPreflightScript, /Production deployment blocked/);
  assert.doesNotMatch(migrationPreflightScript, /migrate", "deploy/);
});

test("Vercel migration checks use the application pooler instead of a stale direct URL", () => {
  const environment = getVerificationEnvironment({
    DATABASE_URL:
      "postgresql://postgres.example:placeholder@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require",
    DIRECT_URL: "postgresql://postgres:placeholder@db.example.supabase.co:6543/postgres",
  });

  assert.equal(environment.DIRECT_URL, environment.DATABASE_URL);
  const migrationUrl = new URL(environment.DATABASE_URL!);
  assert.equal(migrationUrl.port, "5432");
  assert.equal(migrationUrl.searchParams.has("pgbouncer"), false);
});

test("release migration preflight permits reviewed pending migrations but blocks failed ones", () => {
  assert.equal(
    canProceedWithPendingMigrations("Following migrations have not yet been applied:\n20260721180000_expose_department_onboarding_work"),
    true,
  );
  assert.equal(
    canProceedWithPendingMigrations("Following migration have not yet been applied:\n20260717173000_add_space_sidebar_visibility"),
    true,
  );
  assert.equal(
    canProceedWithPendingMigrations("Following migration have failed\nFollowing migration have not yet been applied:"),
    false,
  );
  assert.match(packageJson, /"db:migrate:preflight": "node scripts\/preflight-migrations\.cjs"/);
  assert.match(releaseMigrationPreflightScript, /prismaCommand, \["migrate", "status"\]/);
  assert.doesNotMatch(releaseMigrationPreflightScript, /migrate", "deploy/);
  assert.match(productionReleaseWorkflow, /db:migrate:preflight/);
});

test("release deployment lets Vercel resolve the configured app root once", () => {
  assert.doesNotMatch(productionReleaseWorkflow, /working-directory: artifacts\/up-flow/);
  assert.match(productionReleaseWorkflow, /vercel@56\.2\.1 deploy --prod --yes/);
  assert.match(productionReleaseWorkflow, /vercel@56\.2\.1 curl \/api\/health/);
});
