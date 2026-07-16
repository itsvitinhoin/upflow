import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = join(__dirname, "..", "..");

function read(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

test("ProjectKind is required and indexed for directory queries", () => {
  const schema = read("prisma/schema.prisma");

  assert.match(
    schema,
    /enum ProjectKind \{\s+client\s+internal\s+operational_queue\s+onboarding\s+\}/,
  );
  assert.match(schema, /kind\s+ProjectKind\s+@default\(internal\)/);
  assert.match(schema, /@@index\(\[workspace_id, kind, status\]\)/);
  assert.match(schema, /@@index\(\[workspace_id, company_id, kind\]\)/);
});

test("project-kind backfill is repeatable and preserves project identities", () => {
  const migration = read(
    "prisma/migrations/20260716120000_add_project_kind/migration.sql",
  );

  assert.match(migration, /CREATE TYPE "ProjectKind" AS ENUM/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS "kind"/);
  assert.match(migration, /SET "kind" = 'operational_queue'/);
  assert.match(migration, /"company_id" IS NULL/);
  assert.match(migration, /FROM "ClientOnboarding"/);
  assert.match(migration, /FROM "MarketingB2BOnboardingForm"/);
  assert.match(migration, /FROM "MarketingB2COnboardingForm"/);
  assert.match(migration, /FROM "OnboardingChecklistItem"/);
  assert.match(migration, /\('financeiro', 'client onboarding'\)/);
  assert.match(migration, /\('paid media', 'service onboarding'\)/);
  assert.match(migration, /\('suporte técnico', 'client channels'\)/);
  assert.match(migration, /project\."folder_id" IS NULL/);
  assert.match(migration, /project\."company_id" IS NOT NULL[\s\S]*root_folder/);
  assert.match(migration, /regexp_replace/);
  assert.match(migration, /'contracts handoffs', 'client onboarding', 'client channels', 'service onboarding'/);
  assert.match(migration, /SET "kind" = 'client'/);
  assert.match(migration, /CREATE INDEX IF NOT EXISTS/);
  assert.doesNotMatch(migration, /DELETE FROM "Project"|INSERT INTO "Project"/);
});

test("all project creation paths explicitly assign the appropriate kind", () => {
  const projectsRoute = read("src/app/api/projects/route.ts");
  const templateRoute = read("src/app/api/templates/[id]/apply/route.ts");
  const onboarding = read("src/lib/onboarding.ts");
  const departmentSpaces = read("src/lib/department-spaces.ts");
  const testerWorkspace = read("src/lib/tester-workspace.ts");
  const seed = read("scripts/seed.ts");

  assert.match(
    projectsRoute,
    /kind: start_onboarding && company_id \? "onboarding" : company_id \? "client" : "internal"/,
  );
  assert.match(templateRoute, /template\.type === "operational_queue"/);
  assert.match(templateRoute, /parsed\.data\.company_id[\s\S]*\? "client"[\s\S]*: "internal"/);
  assert.match(onboarding, /kind: "operational_queue"/);
  assert.match(onboarding, /kind: "onboarding"/);
  assert.match(departmentSpaces, /kind: "operational_queue"/);
  assert.match(testerWorkspace, /kind: "client"/);
  assert.match(seed, /kind: "internal"/);
});

test("project creation and onboarding records commit atomically", () => {
  const projectsRoute = read("src/app/api/projects/route.ts");
  const onboarding = read("src/lib/onboarding.ts");

  assert.match(projectsRoute, /prisma\.\$transaction\(async \(tx\) =>/);
  assert.match(projectsRoute, /createClientOnboardingRecordsForProject\(tx/);
  assert.match(onboarding, /export async function finishClientOnboardingStart/);
  assert.match(onboarding, /createClientOnboardingRecordsForProject\(tx, input\)/);
  assert.match(
    onboarding,
    /FROM "Company"[\s\S]*FOR KEY SHARE[\s\S]*FROM "Project"[\s\S]*FOR UPDATE/,
  );
});

test("generic project updates preserve real onboarding workflows", () => {
  const projectRoute = read("src/app/api/projects/[id]/route.ts");

  assert.match(projectRoute, /prisma\.\$transaction\(async \(tx\) =>/);
  assert.match(
    projectRoute,
    /FROM "Company"[\s\S]*FOR KEY SHARE[\s\S]*FROM "Project"[\s\S]*FOR UPDATE/,
  );
  assert.match(projectRoute, /FROM "Project"[\s\S]*FOR UPDATE/);
  assert.match(projectRoute, /onboarding_items:\s*\{\s*some:\s*\{\}/);
  assert.match(projectRoute, /hasOnboardingWorkflow/);
  assert.match(projectRoute, /company_id !== current\.company_id/);
  assert.match(projectRoute, /status: 409/);
});
