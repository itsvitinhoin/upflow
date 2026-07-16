import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  isFinanceOnboardingFormLocation,
  isFinanceOnboardingSpace,
  routeForOnboardingChecklistItem,
  routeForService,
} from "../../src/lib/onboarding-routing";
import { getOnboardingTaskAction, workflowFormKind } from "../../src/lib/onboarding-task-routing";
import { ownerKeyForTaskRoute } from "../../src/lib/onboarding-department-owners";
import type { Task } from "../../src/lib/types";

const ROOT = join(__dirname, "..", "..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

test("onboarding routes recognize named department workflows", () => {
  assert.equal(routeForService("Marketing B2B kickoff"), "marketing_b2b");
  assert.equal(routeForService("Marketing B2C onboarding"), "marketing_b2c");
  assert.equal(routeForService("Cadastro financeiro"), "finance");
  assert.equal(routeForService("Suporte tecnico"), "support");
});

test("unknown onboarding work never falls back into Commercial", () => {
  assert.equal(routeForService("New agency service"), "general_admin");
  assert.equal(ownerKeyForTaskRoute("general_admin"), "general_admin");
  assert.equal(
    routeForOnboardingChecklistItem({
      department: "Service Onboarding",
      service: "Marketing B2B kickoff",
    }),
    "marketing_b2b",
  );
  assert.equal(
    routeForOnboardingChecklistItem({ department: "Contract" }),
    "finance",
  );
});

test("Commercial tasks in Contracts & Handoffs never open the Finance form", () => {
  const task = {
    id: "commercial-onboarding-task",
    project_id: "commercial-project",
    title: "Onboarding: commercial contract handoff confirmed",
    description: "Client contract and commercial onboarding notes were handed off.",
    project: { id: "commercial-project", name: "Contracts & Handoffs" },
    onboarding_link: {
      id: "commercial-checklist-item",
      onboarding_id: "onboarding-1",
      company_id: "company-1",
      company_name: "Teste",
      department: "Commercial",
      title: "Client created and services selected",
      status: "complete",
      progress: 20,
      href: "/clients/company-1",
    },
  } as Task;

  assert.equal(workflowFormKind(task), null);
  assert.equal(getOnboardingTaskAction(task), null);
});

test("Finance forms are valid only for Finance checklist work inside a Finance space", () => {
  assert.equal(isFinanceOnboardingSpace("Finance"), true);
  assert.equal(isFinanceOnboardingSpace("Commercial"), false);
  assert.equal(
    isFinanceOnboardingFormLocation({
      checklistDepartment: "Finance",
      projectSpaceName: "Finance",
    }),
    true,
  );
  assert.equal(
    isFinanceOnboardingFormLocation({
      checklistDepartment: "Contract",
      projectSpaceName: "Financeiro",
    }),
    true,
  );
  assert.equal(
    isFinanceOnboardingFormLocation({
      checklistDepartment: "Commercial",
      projectSpaceName: "Commercial",
    }),
    false,
  );
  assert.equal(
    isFinanceOnboardingFormLocation({
      checklistDepartment: "Finance",
      projectSpaceName: "Commercial",
    }),
    false,
  );
});

test("project task lists repair misrouted onboarding work for workspace admins", () => {
  const onboarding = read("src/lib/onboarding.ts");
  const taskRoute = read("src/app/api/tasks/route.ts");
  const financeFormRoute = read("src/app/api/onboarding/finance-form/[taskId]/route.ts");

  assert.match(onboarding, /export async function repairOnboardingTaskRouting/);
  assert.match(onboarding, /resolveOnboardingRouteProjectId/);
  assert.match(onboarding, /marketingB2BOnboardingForm\.updateMany/);
  assert.match(onboarding, /marketingB2COnboardingForm\.updateMany/);
  assert.match(taskRoute, /isWorkspaceAdminFor\(auth, project\.workspace_id\)/);
  assert.match(taskRoute, /repairOnboardingTaskRouting/);
  assert.match(financeFormRoute, /isFinanceOnboardingFormLocation/);
  assert.match(financeFormRoute, /only available from the Finance space/);
});
