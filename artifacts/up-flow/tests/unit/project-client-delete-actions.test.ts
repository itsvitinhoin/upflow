import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const ROOT = join(__dirname, "..", "..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

test("projects and clients expose card delete actions backed by DELETE routes", () => {
  const projectsPage = read("src/app/(dashboard)/projects/page.tsx");
  const clientsPage = read("src/app/(dashboard)/clients/page.tsx");
  const companyRoute = read("src/app/api/companies/[id]/route.ts");

  assert.match(projectsPage, /Trash2/);
  assert.match(projectsPage, /Delete project/);
  assert.match(projectsPage, /fetch\(`\/api\/projects\/\$\{project\.id\}`,\s*\{\s*method:\s*"DELETE"\s*\}\)/);
  assert.match(projectsPage, /Project deleted/);

  assert.match(clientsPage, /Trash2/);
  assert.match(clientsPage, /Delete client/);
  assert.match(clientsPage, /fetch\(`\/api\/companies\/\$\{company\.id\}`,\s*\{\s*method:\s*"DELETE"\s*\}\)/);
  assert.match(clientsPage, /Client deleted/);

  assert.match(companyRoute, /async function DELETE_handler/);
  assert.match(companyRoute, /isWorkspaceAdminFor\(auth, company\.workspace_id\)/);
  assert.match(companyRoute, /type:\s*"company_deleted"/);
  assert.match(companyRoute, /prisma\.company\.delete/);
  assert.match(companyRoute, /export const DELETE = withErrorReporting\("api:companies\/id:DELETE", DELETE_handler\)/);
});
