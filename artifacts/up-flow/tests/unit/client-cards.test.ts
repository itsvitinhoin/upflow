import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const ROOT = join(__dirname, "..", "..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

test("client cards surface service plan and commercial details", () => {
  const clientsPage = read("src/app/(dashboard)/clients/page.tsx");
  const clientDetail = read("src/app/(dashboard)/clients/[id]/page.tsx");
  const createDialog = read("src/components/dashboard/create-company-dialog.tsx");
  const route = read("src/app/api/companies/route.ts");
  const detailRoute = read("src/app/api/companies/[id]/route.ts");

  assert.match(clientsPage, /company\.plan_name/);
  assert.match(clientsPage, /company\.service_type/);
  assert.match(clientsPage, /company\.included_services/);
  assert.match(clientsPage, /clients\.brandName/);
  assert.match(clientsPage, /clients\.brandType/);
  assert.match(clientsPage, /clients\.contractedPlan/);
  assert.match(clientsPage, /clients\.planServices/);
  assert.match(clientsPage, /clients\.responsibleManager/);
  assert.match(clientsPage, /PlanServiceTile/);
  assert.match(clientsPage, /brandTypeValue/);
  assert.match(clientsPage, /managerName/);
  assert.match(clientsPage, /assigned_members/);
  assert.match(clientsPage, /lg:grid-cols-2 2xl:grid-cols-3/);
  assert.doesNotMatch(clientsPage, /deadlineLabel/);
  assert.doesNotMatch(clientsPage, /MetricTile/);
  assert.match(clientDetail, /t\("clientDetail\.valuePerHour"\)/);
  assert.match(clientDetail, /t\("clientDetail\.linkedProjectTime"\)/);
  assert.match(clientDetail, /commission_per_tracked_hour/);
  assert.match(createDialog, /service_type/);
  assert.match(createDialog, /included_services/);
  assert.match(createDialog, /SERVICE_TYPE_OPTIONS/);
  assert.match(createDialog, /PLAN_OPTIONS/);
  assert.match(createDialog, /SERVICE_OPTIONS/);
  assert.match(createDialog, /value: "Vesti"/);
  assert.match(createDialog, /companyDialog\.service\.vesti/);
  assert.match(createDialog, /BRAND_TYPE_OPTIONS/);
  assert.match(createDialog, /ONBOARDING_PLAN_OPTIONS/);
  assert.match(createDialog, /ONBOARDING_SERVICE_OPTIONS/);
  assert.match(createDialog, /companyDialog\.brandData/);
  assert.match(createDialog, /companyDialog\.negotiatedMonthlyFee/);
  assert.match(createDialog, /companyDialog\.saveDraft/);
  assert.match(createDialog, /findBrandDepartmentId/);
  assert.match(createDialog, /parseCurrencyValue/);
  assert.match(createDialog, /removeService/);
  assert.match(createDialog, /owner_id: assigneeId/);
  assert.match(createDialog, /contact_email: contactEmail/);
  assert.match(createDialog, /responsible_department_id: departmentId/);
  assert.match(createDialog, /\/api\/users\?workspace_id=/);
  assert.match(createDialog, /\/api\/workspaces\/\$\{currentWorkspaceId\}\/departments/);
  assert.match(route, /plan_name/);
  assert.match(route, /included_services/);
  assert.match(route, /owner_id: z\.string/);
  assert.match(route, /contact_email: z\.string\(\)\.trim\(\)\.email/);
  assert.match(route, /responsible_department_id/);
  assert.match(route, /prisma\.workspaceMember\.findFirst/);
  assert.match(route, /contacts:\s*\{/);
  assert.match(route, /active_project_count/);
  assert.match(route, /assigned_members/);
  assert.match(route, /latest_activity/);
  assert.match(route, /health_status/);
  assert.match(route, /tracked_seconds:\s*trackedSeconds/);
  assert.match(route, /contract_value_per_tracked_hour/);
  assert.match(detailRoute, /trackedHours/);
  assert.match(detailRoute, /active_project_count/);
  assert.match(detailRoute, /assigned_members/);
  assert.match(detailRoute, /latest_activity/);
  assert.match(detailRoute, /commission_per_tracked_hour/);
});
