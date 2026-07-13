import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const ROOT = join(__dirname, "..", "..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

test("streamlined client onboarding uses a client-first wizard and stable department queues", () => {
  const schema = read("prisma/schema.prisma");
  const migration = read("prisma/migrations/20260701120000_streamlined_client_onboarding/migration.sql");
  const route = read("src/app/api/onboarding/client-wizard/route.ts");
  const onboardingListRoute = read("src/app/api/onboarding/route.ts");
  const companiesRoute = read("src/app/api/companies/route.ts");
  const updateRoute = read("src/app/api/onboarding/[id]/route.ts");
  const itemRoute = read("src/app/api/onboarding/[id]/items/[itemId]/route.ts");
  const taskRoute = read("src/app/api/tasks/[id]/route.ts");
  const reorderRoute = read("src/app/api/projects/[id]/reorder-tasks/route.ts");
  const helper = read("src/lib/onboarding.ts");
  const dialog = read("src/components/dashboard/create-company-dialog.tsx");
  const taskSheet = read("src/components/projects/task-detail-sheet.tsx");
  const onboardingPanel = read("src/components/onboarding/client-onboarding-panel.tsx");
  const projectPage = read("src/app/(dashboard)/projects/[id]/page.tsx");
  const listView = read("src/components/projects/list-view.tsx");
  const kanbanBoard = read("src/components/projects/kanban-board.tsx");
  const queuePage = read("src/app/(dashboard)/onboarding/page.tsx");
  const notifications = read("src/lib/notification-links.ts");

  assert.match(schema, /project_id\s+String\?\s+@unique/);
  assert.match(schema, /completion_override_reason\s+String\?/);
  assert.match(migration, /ALTER COLUMN "project_id" DROP NOT NULL/);
  assert.match(migration, /ON DELETE SET NULL/);

  assert.match(route, /createClientOnboardingFromWizard/);
  assert.match(companiesRoute, /startClientOnboardingForCompany/);
  assert.match(companiesRoute, /start_onboarding: z\.boolean\(\)\.optional\(\)/);
  assert.match(companiesRoute, /parsed\.data\.start_onboarding === false[\s\S]*startClientOnboardingForCompany/);
  assert.match(route, /included_services: z\.array\(z\.string/);
  assert.match(route, /expected_start_date/);
  assert.match(onboardingListRoute, /projectCompanyId/);
  assert.match(onboardingListRoute, /OR:[\s\S]*company_id: projectCompanyId/);
  assert.match(onboardingPanel, /params\.set\("company_id", companyId\)/);
  assert.match(onboardingPanel, /params\.set\("project_id", projectId\)/);
  assert.match(projectPage, /project\.onboarding_enabled && \([\s\S]*<ClientOnboardingPanel/);
  assert.match(updateRoute, /completion_override/);
  assert.match(updateRoute, /completion_override_reason/);
  assert.match(updateRoute, /completion_override[\s\S]*findUniqueOrThrow[\s\S]*select: onboardingSelect\(\)[\s\S]*return \{ onboarding, notificationTargets \}/);
  assert.match(route, /withErrorReporting\("api:onboarding\/client-wizard:POST"/);
  assert.match(dialog, /\/api\/onboarding\/client-wizard/);
  assert.match(dialog, /companyDialog\.createAndStart/);
  assert.match(dialog, /companyDialog\.brandType/);
  assert.match(dialog, /companyDialog\.planServices/);
  assert.match(dialog, /companyDialog\.negotiatedMonthlyFee/);

  assert.match(helper, /const ONBOARDING_SAFE_SCALAR_SELECT = \{/);
  assert.match(helper, /export function onboardingSelect\(\)/);
  assert.match(helper, /export async function startClientOnboardingForCompany/);
  assert.match(helper, /select: onboardingSelect\(\)/);
  assert.doesNotMatch(helper, /onboardingInclude/);
  assert.doesNotMatch(helper, /completion_override_reason/);
  assert.doesNotMatch(route, /include: onboardingInclude/);
  assert.doesNotMatch(updateRoute, /include: onboardingInclude/);

  assert.match(helper, /projectName: "Contracts & Handoffs"/);
  assert.match(helper, /projectName: "Client Onboarding"/);
  assert.match(helper, /projectName: "Client Channels"/);
  assert.match(helper, /projectName: "Service Onboarding"/);
  assert.doesNotMatch(helper, /Onboarding - /);

  assert.match(helper, /status: needsMapping \? "needs_mapping" : "assigned"/);
  assert.match(helper, /missingMappings/);
  assert.match(helper, /export async function getOnboardingCompletionBlocker/);
  assert.match(helper, /export async function getOnboardingTaskCompletionBlocker/);
  assert.match(helper, /export async function syncOnboardingChecklistFromTaskStatus/);
  assert.match(helper, /source: "task_status_sync"/);
  assert.match(itemRoute, /getOnboardingCompletionBlocker/);
  assert.match(taskRoute, /getOnboardingTaskCompletionBlocker/);
  assert.match(taskRoute, /syncOnboardingChecklistFromTaskStatus/);
  assert.match(taskRoute, /canUpdateDepartmentOnboardingStatus/);
  assert.match(reorderRoute, /syncOnboardingChecklistFromTaskStatus/);
  assert.match(reorderRoute, /canMoveDepartmentOnboardingTask/);
  assert.match(reorderRoute, /dstColumn === "done"/);
  assert.match(taskSheet, /readTaskApiError/);
  assert.match(listView, /readTaskApiError/);
  assert.match(kanbanBoard, /readTaskApiError/);
  assert.match(onboardingPanel, /onboardingWorkflow\.overrideAction/);
  assert.match(queuePage, /onboardingQueue\.view\.missingMapping/);
  assert.match(notifications, /client_onboarding/);
  assert.match(notifications, /\/clients\/\$\{data\.company_id\}/);
});
