import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const ROOT = join(__dirname, "..", "..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

test("Marketing B2B onboarding uses routed department form tasks", () => {
  const schema = read("prisma/schema.prisma");
  const migration = read("prisma/migrations/20260702120000_marketing_b2b_onboarding_forms/migration.sql");
  const helper = read("src/lib/onboarding.ts");
  const route = read("src/app/api/onboarding/marketing-b2b-form/[taskId]/route.ts");
  const form = read("src/components/onboarding/marketing-b2b-onboarding-form.tsx");
  const panel = read("src/components/onboarding/client-onboarding-panel.tsx");
  const taskListRoute = read("src/app/api/tasks/route.ts");
  const taskDetailRoute = read("src/app/api/tasks/[id]/route.ts");
  const kanbanBoard = read("src/components/projects/kanban-board.tsx");
  const projectPage = read("src/app/(dashboard)/projects/[id]/page.tsx");
  const translations = read("src/lib/i18n/translations.ts");

  assert.match(schema, /model MarketingB2BOnboardingForm/);
  assert.match(schema, /marketing_b2b_onboarding_form\s+MarketingB2BOnboardingForm\?/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS "MarketingB2BOnboardingForm"/);
  assert.match(migration, /UNIQUE INDEX IF NOT EXISTS "MarketingB2BOnboardingForm_task_id_key"/);

  assert.match(helper, /MARKETING_B2B_FORM_SERVICES/);
  assert.match(helper, /isMarketingB2BFormService/);
  assert.match(helper, /resolveMarketingB2BOnboardingProjectId/);
  assert.match(helper, /name: "Onboarding"/);
  assert.match(helper, /Marketing B2B Onboarding/);
  assert.match(helper, /folder_id: clientFolder\.id/);
  assert.match(helper, /b2bFormServices/);
  assert.match(helper, /marketingB2BOnboardingForm\.create/);
  assert.match(helper, /b2bFormServiceKeys\.has\(serviceKey\(service\)\)/);

  assert.match(route, /values: valuesRef|values: nextValues|marketingB2BOnboardingForm\.update/);
  assert.match(route, /finalize/);
  assert.match(route, /task\.update[\s\S]*status: "done"/);
  assert.match(route, /onboardingChecklistItem\.update[\s\S]*status: "complete"/);
  assert.match(route, /recomputeOnboardingProgress/);
  assert.match(route, /withErrorReporting\("api:onboarding\/marketing-b2b-form:PATCH"/);

  assert.match(form, /scheduleFieldSave/);
  assert.match(form, /valuesRef\.current/);
  assert.match(form, /finalizeAction/);
  assert.match(form, /brandName/);
  assert.match(form, /metaAdsAccess/);
  assert.match(panel, /marketing_b2b_form/);
  assert.match(panel, /marketingB2BForm\.centralHint/);

  assert.match(taskListRoute, /marketing_b2b_onboarding_form/);
  assert.match(taskDetailRoute, /marketing_b2b_onboarding_form/);
  assert.match(kanbanBoard, /MarketingB2BOnboardingForm/);
  assert.match(projectPage, /MarketingB2BOnboardingForm/);

  assert.match(translations, /marketingB2BForm\.field\.brandName/);
  assert.match(translations, /marketingB2BForm\.field\.metaAdsAccess/);
  assert.match(translations, /marketingB2BForm\.finalizeAction/);
});
