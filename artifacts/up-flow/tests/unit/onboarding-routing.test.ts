import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  routeForOnboardingChecklistItem,
  routeForService,
} from "../../src/lib/onboarding-routing";
import { ownerKeyForTaskRoute } from "../../src/lib/onboarding-department-owners";

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

test("project task lists repair misrouted onboarding work for workspace admins", () => {
  const onboarding = read("src/lib/onboarding.ts");
  const taskRoute = read("src/app/api/tasks/route.ts");

  assert.match(onboarding, /export async function repairOnboardingTaskRouting/);
  assert.match(onboarding, /resolveOnboardingRouteProjectId/);
  assert.match(onboarding, /marketingB2BOnboardingForm\.updateMany/);
  assert.match(onboarding, /marketingB2COnboardingForm\.updateMany/);
  assert.match(taskRoute, /isWorkspaceAdminFor\(auth, project\.workspace_id\)/);
  assert.match(taskRoute, /repairOnboardingTaskRouting/);
});
