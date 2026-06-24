import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const root = join(__dirname, "..", "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

test("workspace sharing supports guest invites and team role management", () => {
  const schema = read("prisma/schema.prisma");
  const migration = read("prisma/migrations/20260624120000_add_workspace_guest_role/migration.sql");
  const inviteRoute = read("src/app/api/invites/route.ts");
  const acceptRoute = read("src/app/api/invites/accept/route.ts");
  const inviteDialog = read("src/components/dashboard/invite-dialog.tsx");
  const teamPage = read("src/app/(dashboard)/team/page.tsx");

  assert.match(schema, /enum WorkspaceRole[\s\S]*guest/);
  assert.match(migration, /ADD VALUE IF NOT EXISTS 'guest'/);
  assert.match(inviteRoute, /role\?: "admin" \| "member" \| "guest"/);
  assert.match(acceptRoute, /role === "guest"/);
  assert.match(inviteDialog, /<option value="guest">/);
  assert.match(teamPage, /<option value="guest">/);
});

test("members and guests can read workspace records but cannot mutate them", () => {
  const projectAccess = read("src/lib/project-access.ts");
  const spacesRoute = read("src/app/api/spaces/route.ts");
  const foldersRoute = read("src/app/api/folders/route.ts");
  const projectsRoute = read("src/app/api/projects/route.ts");
  const tasksRoute = read("src/app/api/tasks/route.ts");
  const commentsRoute = read("src/app/api/comments/route.ts");
  const docsRoute = read("src/app/api/docs/route.ts");
  const calendarRoute = read("src/app/api/calendar/events/route.ts");
  const companiesRoute = read("src/app/api/companies/route.ts");
  const sidebarPanel = read("src/components/layout/sidebar/panel.tsx");
  const header = read("src/components/layout/header.tsx");

  assert.match(projectAccess, /return canAccessWorkspace\(auth, project\.workspace_id\)/);
  assert.match(projectAccess, /return isWorkspaceAdminFor\(auth, project\.workspace_id\)/);
  for (const route of [
    spacesRoute,
    foldersRoute,
    projectsRoute,
    commentsRoute,
    docsRoute,
    calendarRoute,
    companiesRoute,
  ]) {
    assert.match(route, /isWorkspaceAdminFor/);
  }
  assert.match(tasksRoute, /canContributeToProject\(auth,\s*project\)/);
  assert.match(sidebarPanel, /canManageWorkspace/);
  assert.match(header, /canCreateProject/);
});
