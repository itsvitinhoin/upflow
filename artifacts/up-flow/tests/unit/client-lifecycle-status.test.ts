import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const ROOT = join(__dirname, "..", "..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

test("clients can be marked inactive and filtered by lifecycle status", () => {
  const companiesRoute = read("src/app/api/companies/route.ts");
  const companyRoute = read("src/app/api/companies/[id]/route.ts");
  const clientsPage = read("src/app/(dashboard)/clients/page.tsx");
  const translations = read("src/lib/i18n/translations.ts");

  assert.match(companiesRoute, /CompanyStatusFilterSchema = z\.enum\(\["all", "active", "inactive"\]\)/);
  assert.match(companiesRoute, /\(url\.searchParams\.get\("status"\) \|\| "active"\)/);
  assert.match(companiesRoute, /case "active":[\s\S]*return \{ status: "active" \}/);
  assert.match(companiesRoute, /case "inactive":[\s\S]*status: \{ in: \["inactive", "archived"\] \}/);
  assert.match(companiesRoute, /\.\.\.statusWhere/);
  assert.match(companyRoute, /status: z\.string\(\)\.trim\(\)\.optional\(\)/);
  assert.match(companyRoute, /isWorkspaceAdminFor\(auth, company\.workspace_id\)/);
  assert.match(companyRoute, /previous_status: company\.status, status: updated\.status/);

  assert.match(clientsPage, /type ClientStatusFilter = "all" \| "active" \| "inactive"/);
  assert.match(clientsPage, /useState<ClientStatusFilter>\("active"\)/);
  assert.match(clientsPage, /params\.set\("status", statusFilter\)/);
  assert.match(clientsPage, /data-testid=\{"client-status-filter-" \+ status\}/);
  assert.match(clientsPage, /data-testid="client-status-toggle"/);
  assert.match(clientsPage, /method: "PATCH"/);
  assert.match(clientsPage, /JSON\.stringify\(\{ status: nextStatus \}\)/);
  assert.match(clientsPage, /clients\.deactivateClient/);
  assert.match(clientsPage, /clients\.reactivateClient/);
  assert.match(clientsPage, /clients\.noInactiveClients/);

  assert.match(translations, /"clients\.status\.inactive": "Inactive"/);
  assert.match(translations, /"clients\.status\.inactive": "Inativos"/);
  assert.match(translations, /"clients\.deactivateClient": "Desativar cliente"/);
});
