import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import test from "node:test";

const require = createRequire(import.meta.url);
const { getMigrationDatabaseUrl } = require("../../scripts/migration-database-url.cjs") as {
  getMigrationDatabaseUrl: (databaseUrl: string | undefined) => string | undefined;
};

const migrationDeployScript = readFileSync(
  new URL("../../scripts/deploy-migrations.cjs", import.meta.url),
  "utf8",
);
const packageJson = readFileSync(new URL("../../package.json", import.meta.url), "utf8");

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
