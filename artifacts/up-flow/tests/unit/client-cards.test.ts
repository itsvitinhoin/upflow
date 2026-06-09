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
  assert.match(clientsPage, /Commission/);
  assert.match(clientsPage, /Linked time/);
  assert.match(clientsPage, /contract_value_per_tracked_hour/);
  assert.match(clientDetail, /Value \/ hour/);
  assert.match(clientDetail, /Linked project time only/);
  assert.match(clientDetail, /commission_per_tracked_hour/);
  assert.match(createDialog, /service_type/);
  assert.match(createDialog, /included_services/);
  assert.match(route, /plan_name/);
  assert.match(route, /included_services/);
  assert.match(route, /tracked_seconds:\s*trackedSeconds/);
  assert.match(route, /contract_value_per_tracked_hour/);
  assert.match(detailRoute, /trackedHours/);
  assert.match(detailRoute, /commission_per_tracked_hour/);
});
