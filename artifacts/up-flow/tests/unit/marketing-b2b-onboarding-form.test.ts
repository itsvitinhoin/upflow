import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";
import { getOnboardingTaskAction, workflowFormKind } from "../../src/lib/onboarding-task-routing";
import type { Task } from "../../src/lib/types";

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
  assert.match(helper, /MARKETING_B2B_FORM_SERVICES[\s\S]*"Vesti"/);
  assert.match(helper, /isMarketingB2BFormService[\s\S]*key === "vesti"/);
  assert.match(helper, /routeForService[\s\S]*key\.includes\("vesti"\)/);
  assert.match(helper, /isMarketingB2BFormService/);
  assert.match(helper, /resolveMarketingB2BOnboardingProjectId/);
  assert.match(helper, /name: "Onboarding"/);
  assert.match(helper, /Marketing B2B Onboarding/);
  assert.match(helper, /folder_id: clientFolder\.id/);
  assert.match(helper, /b2bFormServices/);
  assert.match(helper, /marketingB2BOnboardingForm\.create/);
  assert.match(helper, /b2bFormServiceKeys\.has\(serviceKey\(service\)\)/);

  assert.match(route, /values: valuesRef|values: nextValues|marketingB2BOnboardingForm\.update/);
  assert.match(route, /ensureBackfilledB2BForm/);
  assert.match(route, /onboardingChecklistItem\.findFirst/);
  assert.match(route, /marketingB2BOnboardingForm\.create/);
  assert.match(route, /finalize/);
  assert.match(route, /status: "in_progress"/);
  assert.match(route, /task\.update[\s\S]*status: "done"/);
  assert.match(route, /onboardingChecklistItem\.update[\s\S]*status: "complete"/);
  assert.match(route, /recomputeOnboardingProgress/);
  assert.match(route, /withErrorReporting\("api:onboarding\/marketing-b2b-form:PATCH"/);

  assert.match(form, /updateField/);
  assert.match(form, /valuesRef\.current/);
  assert.match(form, /const finalize = async/);
  assert.match(form, /textValue\(values, "brand\.name"\)/);
  assert.match(form, /\["metaAds", "Meta Ads"\]/);
  assert.match(form, /embedded = false/);
  assert.match(panel, /marketing_b2b_form/);
  assert.match(panel, /marketingB2BForm\.centralHint/);
  assert.match(panel, /marketingB2BSummary/);
  assert.match(panel, /marketingB2BForm\.summaryTitle/);
  assert.match(panel, /\?view=form&/);

  assert.match(taskListRoute, /marketing_b2b_onboarding_form/);
  assert.match(taskDetailRoute, /marketing_b2b_onboarding_form/);
  assert.match(kanbanBoard, /MarketingB2BOnboardingForm/);
  assert.match(kanbanBoard, /onOpenTask/);
  assert.match(projectPage, /MarketingB2BOnboardingForm/);
  assert.match(projectPage, /viewParam !== "kanban"/);
  assert.match(projectPage, /\?view=form&task=/);
  assert.match(projectPage, /embedded onUpdate=\{loadData\}/);

  assert.match(translations, /marketingB2BForm\.field\.brandName/);
  assert.match(translations, /marketingB2BForm\.field\.metaAdsAccess/);
  assert.match(translations, /marketingB2BForm\.finalizeAction/);
  assert.match(translations, /marketingB2BForm\.summaryTitle/);
});

test("Marketing B2B form task opens the form before relation backfill", () => {
  const task = {
    id: "task-b2b-form",
    title: "Marketing B2B onboarding form",
    description:
      "Marketing B2B queue action: complete the client onboarding form. Fields are optional and autosaved.",
    project_id: "project-b2b",
    project: { id: "project-b2b", name: "Teste 01" },
    onboarding_link: {
      id: "checklist-b2b",
      onboarding_id: "onboarding-1",
      company_id: "company-1",
      company_name: "Teste 01",
      department: "Marketing B2B",
      title: "Marketing B2B onboarding form completed",
      status: "pending",
      progress: 18,
      href: "/clients/company-1",
    },
  } as Task;

  assert.equal(workflowFormKind(task), "marketing_b2b");
  assert.deepEqual(getOnboardingTaskAction(task), {
    kind: "form",
    href: "/projects/project-b2b?view=form&task=task-b2b-form",
    formKind: "marketing_b2b",
  });
});
