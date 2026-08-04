import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const ROOT = join(__dirname, "..", "..");

function read(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

test("active non-guest members can create projects and receive project contribution capability", () => {
  const projectsRoute = read("src/app/api/projects/route.ts");
  const projectRoute = read("src/app/api/projects/[id]/route.ts");
  const projectPage = read("src/app/(dashboard)/projects/[id]/page.tsx");

  assert.match(projectsRoute, /async function canCreateProjectInWorkspace/);
  assert.match(
    projectsRoute,
    /return Boolean\(member\?\.status === "active" && member\.role !== "guest"\);/,
  );
  assert.match(
    projectsRoute,
    /canCreateProjectInWorkspace\(auth\.prismaUser\.id, auth\.currentWorkspaceId, isAdmin\)/,
  );

  assert.match(
    projectRoute,
    /capabilities:\s*\{\s*canContribute:\s*await canContributeToProject\(auth, project\),/s,
  );
  assert.match(projectRoute, /canManageMembers:/);
  assert.match(
    projectPage,
    /const canCreateTasks = Boolean\(project\?\.capabilities\?\.canContribute\);/,
  );
  assert.match(projectPage, /canCreate=\{canCreateTasks\}/);
});

test("task creation stops before submission when project contribution capability is false", () => {
  const sheet = read("src/components/projects/task-create-sheet.tsx");

  assert.match(
    sheet,
    /const contributorAccessDenied = Boolean\([\s\S]*!projectContext\.capabilities\.canContribute,[\s\S]*\);/,
  );
  assert.match(
    sheet,
    /if \(project\.capabilities && !project\.capabilities\.canContribute\) \{\s*setContextError\(t\("task\.contributorAccessRequired"\)\);\s*return;\s*\}/s,
  );
  assert.match(
    sheet,
    /if \(contributorAccessDenied\) \{\s*setContextError\(t\("task\.contributorAccessRequired"\)\);\s*setAnnouncement\(t\("task\.contributorAccessRequired"\)\);\s*return;\s*\}/s,
  );
  assert.match(
    sheet,
    /disabled=\{submitting \|\| projectsLoading \|\| contextLoading \|\| contributorAccessDenied\}/,
  );
});

test("space structure controls stay admin-only while active members can create work", () => {
  const spacePage = read("src/app/(dashboard)/spaces/[id]/page.tsx");
  const spaceBrowser = read("src/components/spaces/space-browser.tsx");

  const structureControls = spacePage.match(
    /\{canManageWorkspace && \(\s*<>[\s\S]*?<\/>\s*\)\}/,
  )?.[0];
  assert.ok(structureControls, "expected a workspace-management gate around structural controls");
  assert.match(structureControls, /setShowNewFolder\(true\)/);
  assert.match(structureControls, /setShowNewList\(true\)/);
  assert.doesNotMatch(structureControls, /showNewProject|setShowNewProject/);

  assert.match(spacePage, /canManageStructure=\{canManageWorkspace\}/);
  assert.match(
    spaceBrowser,
    /\{canManageStructure && \(\s*<div className="mt-5 flex flex-wrap justify-center gap-2">/s,
  );
  assert.match(spaceBrowser, /onClick=\{onNewFolder\}/);
  assert.match(spaceBrowser, /onClick=\{onNewList\}/);

  assert.match(
    spacePage,
    /const canCreateWorkspaceWork = Boolean\([\s\S]*?currentRole === "member"[\s\S]*?\);/,
  );
  assert.match(
    spacePage,
    /onCreateTask=\{canCreateWorkspaceWork \? openTaskCreate : undefined\}/,
  );
  assert.match(
    spacePage,
    /onCreateMeeting=\{canCreateWorkspaceWork \? openMeetingCreate : undefined\}/,
  );
  assert.match(
    spacePage,
    /onCreateProject=\{canCreateWorkspaceWork \? \(\) => setShowNewProject\(true\) : undefined\}/,
  );
  assert.match(spacePage, /<NewProjectDialog\s+open=\{canCreateWorkspaceWork && showNewProject\}/s);
});

test("read-only project users stay in view mode and cannot mutate the social calendar", () => {
  const projectPage = read("src/app/(dashboard)/projects/[id]/page.tsx");
  const socialCalendar = read("src/components/projects/social-media-calendar.tsx");

  assert.match(projectPage, /action\?\.kind === "form" && canCreateTasks/);
  assert.match(projectPage, /action && action\.kind !== "form"/);
  assert.match(projectPage, /selectedTask && canCreateTasks && workflowFormKind\(selectedTask\)/);
  assert.match(
    projectPage,
    /<SocialMediaCalendar[\s\S]*?canContribute=\{canCreateTasks\}/,
  );

  assert.match(socialCalendar, /canContribute: boolean;/);
  assert.match(socialCalendar, /if \(!canContribute\) return;/);
  assert.match(socialCalendar, /disabled=\{!canContribute \|\| !moodboardReady/);
  assert.match(socialCalendar, /\{canContribute && \(\s*<button[\s\S]*?New content plan/s);
});
