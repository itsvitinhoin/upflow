import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const ROOT = join(__dirname, "..", "..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

test("ProjectMember limits project and task visibility when a project has explicit members", () => {
  const helper = read("src/lib/project-access.ts");
  const projectsRoute = read("src/app/api/projects/route.ts");
  const projectRoute = read("src/app/api/projects/[id]/route.ts");
  const tasksRoute = read("src/app/api/tasks/route.ts");
  const taskRoute = read("src/app/api/tasks/[id]/route.ts");
  const sidebarRoute = read("src/app/api/sidebar/route.ts");
  const searchRoute = read("src/app/api/search/route.ts");
  const scopeHelper = read("src/lib/api/scope.ts");

  assert.match(helper, /project_members:\s*\{\s*none:\s*\{\s*\}/);
  assert.match(helper, /project_members:\s*\{\s*some:\s*\{\s*user_id:\s*auth\.prismaUser\.id/);
  assert.match(helper, /project_id_user_id/);
  assert.match(helper, /hasExplicitMembers/);
  assert.match(projectsRoute, /readableProjectWhere\(auth,\s*auth\.currentWorkspaceId\)/);
  assert.match(projectRoute, /canReadProject\(auth,\s*project\)/);
  assert.match(tasksRoute, /readableProjectWhere\(auth,\s*auth\.currentWorkspaceId\)/);
  assert.match(tasksRoute, /canContributeToProject\(auth,\s*project\)/);
  assert.match(taskRoute, /canReadProject\(auth,\s*task\.project\)/);
  assert.match(taskRoute, /canContributeToProject\(auth,\s*oldTask\.project\)/);
  assert.match(sidebarRoute, /readableProjectWhere\(auth,\s*auth\.currentWorkspaceId\)/);
  assert.match(searchRoute, /readableProjectWhere\(auth,\s*workspaceId\)/);
  assert.match(searchRoute, /const taskScope = \{\s*project:\s*projectScope\s*\}/);
  assert.match(searchRoute, /const docScope = \{\s*workspace_id:\s*workspaceId,\s*project:\s*projectScope\s*\}/);
  assert.match(scopeHelper, /validateReadableProjectScope/);
  assert.match(scopeHelper, /validateContributableProjectScope/);
  assert.match(scopeHelper, /validateReadableTaskScope/);
  assert.match(scopeHelper, /validateContributableTaskScope/);
  assert.match(scopeHelper, /canReadProject\(auth,\s*project\)/);
  assert.match(scopeHelper, /canContributeToProject\(auth,\s*project\)/);
});

test("task assignment honors explicit project membership, not only workspace membership", () => {
  const helper = read("src/lib/project-access.ts");
  const tasksRoute = read("src/app/api/tasks/route.ts");
  const taskRoute = read("src/app/api/tasks/[id]/route.ts");

  assert.match(helper, /canAssignUserToProject/);
  assert.match(helper, /workspaceMember\.findFirst/);
  assert.match(helper, /project\.owner_id === userId/);
  assert.match(tasksRoute, /canAssignUserToProject\(project,\s*assignee_id\)/);
  assert.match(taskRoute, /canAssignUserToProject\(oldTask\.project,\s*assignee_id\)/);
});
