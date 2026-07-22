import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = join(__dirname, "..", "..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

test("onboarding workflow hardening keeps actions, access, and integrity aligned", () => {
  const board = read("src/app/(dashboard)/onboarding/page.tsx");
  const clientPage = read("src/app/(dashboard)/clients/[id]/page.tsx");
  const onboarding = read("src/lib/onboarding.ts");
  const companyRoute = read("src/app/api/companies/[id]/route.ts");
  const financeRoute = read("src/app/api/onboarding/finance-form/[taskId]/route.ts");
  const supportRoute = read("src/app/api/onboarding/support-form/[taskId]/route.ts");
  const b2bRoute = read("src/app/api/onboarding/marketing-b2b-form/[taskId]/route.ts");
  const assignmentRoute = read("src/app/api/onboarding/[id]/route.ts");
  const onboardingListRoute = read("src/app/api/onboarding/route.ts");
  const onboardingDetailRoute = read("src/app/api/onboarding/[id]/route.ts");
  const panel = read("src/components/onboarding/client-onboarding-panel.tsx");
  const types = read("src/lib/types.ts");
  const taskDelete = read("src/lib/task-delete.ts");
  const singleTaskRoute = read("src/app/api/tasks/[id]/route.ts");
  const bulkTaskRoute = read("src/app/api/tasks/route.ts");
  const projectDelete = read("src/app/api/projects/[id]/route.ts");
  const folderDelete = read("src/app/api/folders/[id]/route.ts");
  const projectDeleteLib = read("src/lib/project-delete.ts");
  const startDialog = read("src/components/onboarding/start-client-onboarding-dialog.tsx");


  assert.match(clientPage, /ClientOnboardingPanel/);
  assert.match(clientPage, /<section id="onboarding"/);
  assert.match(board, /function isMarketingB2COnboarding/);
  assert.match(board, /meetings\.length > 0 && meetings\.every/);
  assert.match(board, /function WorkflowRow\([\s\S]*href: string/);
  assert.match(board, /<Link href=\{href\}/);
  assert.doesNotMatch(board, /<button type="button"[^>]*>\{action\}<\/button>/);
  assert.match(board, /meetingStageState/);
  assert.match(board, /aria-label=\{t\("onboardingQueue\.searchPlaceholder"\)\}/);
  assert.match(board, /action=\{t\("onboardingBoard\.openWorkflow"\)\}/);
  assert.match(startDialog, /event\.key === "Escape"/);

  assert.match(onboarding, /canAccessWorkspace\(auth, onboarding\.workspace_id\)/);
  assert.match(onboarding, /status: "active"/);
  assert.match(onboarding, /form && form\.status !== "complete"/);
  assert.match(onboarding, /meeting && !meeting\.scheduled/);

  assert.match(types, /export interface OnboardingCapabilities/);
  assert.match(onboarding, /export function onboardingCapabilities/);
  assert.match(onboardingListRoute, /capabilities: onboardingCapabilities\(access, row\.checklist_items\)/);
  assert.match(onboardingDetailRoute, /capabilities: onboardingCapabilities\(access, onboarding\.checklist_items\)/);
  assert.match(panel, /const canManageOnboarding = Boolean\(onboarding\?\.capabilities\?\.can_manage\)/);
  assert.match(panel, /disabled=\{!canManageOnboarding \|\| saving === "completion-override"\}/);
  assert.match(panel, /const canUpdateItem = editableChecklistItemIds\.includes\(item\.id\)/);
  assert.match(panel, /disabled=\{!canUpdateItem \|\| saving === item\.id\}/);
  assert.match(panel, /if \(!onboarding \|\| !canUpdateSupport\) return;/);
  assert.match(panel, /<fieldset disabled=\{!canUpdateSupport \|\| saving === "support"\}/);
  assert.match(panel, /fetch\("\/api\/companies\/access", \{ cache: "no-store" \}\)/);
  assert.match(panel, /projectId && teamOptions\.isAdmin/);

  assert.match(companyRoute, /sameServiceSet/);
  assert.match(companyRoute, /Services cannot be changed while onboarding is active/);
  assert.match(financeRoute, /getOnboardingCompletionBlocker/);
  assert.match(financeRoute, /result\.blocker/);
  assert.match(supportRoute, /routeForOnboardingChecklistItem\(item\) !== "support"/);
  assert.match(b2bRoute, /const task = await prisma\.task\.findUnique/);
  assert.match(b2bRoute, /async function POST_handler[\s\S]*if \(!access\.canEdit\)/);
  assert.match(assignmentRoute, /leaderWasProvided/);
  assert.match(assignmentRoute, /if \(form && leaderWasProvided\)/);
  assert.match(assignmentRoute, /if \(meeting\?\.checklist_item_id && leaderWasProvided\)/);

  assert.match(taskDelete, /findOnboardingTaskLink/);
  assert.match(singleTaskRoute, /findOnboardingTaskLink/);
  assert.match(bulkTaskRoute, /findOnboardingTaskLink/);
  assert.match(singleTaskRoute, /status: 409/);
  assert.match(bulkTaskRoute, /status: 409/);
  assert.match(projectDeleteLib, /findActiveOnboardingProject/);
  assert.match(projectDeleteLib, /status: \{ not: "onboarding_complete" \}/);
  assert.match(projectDelete, /findActiveOnboardingProject/);
  assert.match(folderDelete, /findActiveOnboardingProject/);
});
