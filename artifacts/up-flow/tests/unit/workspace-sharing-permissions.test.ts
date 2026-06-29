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
  const permissionMatrix = read("src/lib/permission-matrix.ts");
  const permissionPage = read("src/app/(dashboard)/settings/permissions/page.tsx");
  const settingsPage = read("src/app/(dashboard)/settings/page.tsx");

  assert.match(schema, /enum WorkspaceRole[\s\S]*guest/);
  assert.match(migration, /ADD VALUE IF NOT EXISTS 'guest'/);
  assert.match(inviteRoute, /role\?: "admin" \| "member" \| "guest"/);
  assert.match(acceptRoute, /role === "guest"/);
  assert.match(inviteDialog, /<option value="guest">/);
  assert.match(teamPage, /<option value="guest">/);
  assert.match(permissionMatrix, /export type PermissionRole = "owner" \| "admin" \| "member" \| "guest"/);
  assert.match(permissionMatrix, /levels:\s*\{\s*owner:\s*"manage",\s*admin:\s*"manage",\s*member:\s*"view",\s*guest:\s*"view"\s*\}/);
  assert.match(permissionPage, /permissionMatrixSections/);
  assert.match(settingsPage, /\/settings\/permissions/);
});

test("workspace share dialog renders outside sidebar stacking contexts", () => {
  const inviteDialog = read("src/components/dashboard/invite-dialog.tsx");
  const workspaceSwitcher = read("src/components/layout/workspace-switcher.tsx");

  assert.match(workspaceSwitcher, /setInviteOpen\(true\)/);
  assert.match(workspaceSwitcher, /defaultMode="workspace_access"/);
  assert.match(workspaceSwitcher, /hideMode/);
  assert.match(inviteDialog, /createPortal/);
  assert.match(inviteDialog, /document\.body/);
  assert.match(inviteDialog, /mounted/);
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
  const companyNotesRoute = read("src/app/api/companies/[id]/notes/route.ts");
  const companyContactsRoute = read("src/app/api/companies/[id]/contacts/route.ts");
  const templatesRoute = read("src/app/api/templates/route.ts");
  const applyTemplateRoute = read("src/app/api/templates/[id]/apply/route.ts");
  const goalsRoute = read("src/app/api/goals/route.ts");
  const uploadRoute = read("src/app/api/uploads/task-cover/route.ts");
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
    companyNotesRoute,
    companyContactsRoute,
    templatesRoute,
    applyTemplateRoute,
    uploadRoute,
  ]) {
    assert.match(route, /isWorkspaceAdminFor/);
  }
  assert.match(goalsRoute, /requireWorkspaceAdmin/);
  assert.match(tasksRoute, /canContributeToProject\(auth,\s*project\)/);
  assert.match(sidebarPanel, /canManageWorkspace/);
  assert.match(header, /canCreateProject/);
});
