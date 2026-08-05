import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const ROOT = join(__dirname, "..", "..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

test("home dashboard defaults to a focused today and risks command center", () => {
  const page = read("src/app/(dashboard)/page.tsx");
  const agencyPanel = read("src/components/dashboard/agency-operations-panel.tsx");
  const teamTimeline = read("src/components/dashboard/team-timeline.tsx");
  const taskDetailModal = read("src/components/dashboard/task-detail-modal.tsx");

  assert.match(page, /t\("dashboard\.commandCenter"\)/);
  assert.match(page, /TodayFocusPanel/);
  assert.match(page, /QuickCreateMenu/);
  assert.match(page, /StatusCountButton/);
  assert.match(page, /<TeamTimeline\s/);
  assert.match(page, /components\/dashboard\/team-timeline/);
  assert.match(page, /agency-operations-panel/);
  assert.match(agencyPanel, /t\("dashboard\.agencyOperationsTitle"\)/);
  assert.match(teamTimeline, /t\("timeline\.subtitle"\)/);
  assert.match(teamTimeline, /buildTimelineRowsFromData/);
  assert.match(teamTimeline, /appTimeInputValue/);
  assert.match(teamTimeline, /formatTime/);
  assert.match(teamTimeline, /startLabel/);
  assert.match(teamTimeline, /aria-label=\{tooltip\}/);
  assert.doesNotMatch(teamTimeline, /fmtH\(b\.start\)/);
  assert.match(page, /\/api\/dashboard\/summary/);
  assert.doesNotMatch(page, /function AgencyOperationsPanel/);
  assert.doesNotMatch(page, /function TeamTimeline/);
  assert.doesNotMatch(page, /type TimelineBlock/);
  assert.doesNotMatch(page, /<RightPanel\s/);
  assert.doesNotMatch(page, /<QuickAction\s/);
  assert.doesNotMatch(page, /<StatCard\s/);
  assert.doesNotMatch(page, /<PeopleCard\s/);
  assert.doesNotMatch(page, /function TaskDetailModal/);
  assert.match(page, /components\/dashboard\/task-detail-modal/);
  assert.match(taskDetailModal, /aria-modal="true"/);
  assert.match(taskDetailModal, /focusables/);
  assert.match(taskDetailModal, /t\("task\.deleteTask"\)/);
});

test("desktop sidebar exposes a clear sliding drawer toggle", () => {
  const sidebar = read("src/components/layout/sidebar.tsx");
  const rail = read("src/components/layout/sidebar/rail.tsx");
  const panel = read("src/components/layout/sidebar/panel.tsx");

  assert.match(sidebar, /transition-\[width,opacity\]/);
  assert.match(sidebar, /aria-hidden=\{!panelOpen\}/);
  assert.match(sidebar, /onRequestClose=\{\(\) => setPanelOpen\(false\)\}/);
  assert.match(rail, /sidebar\.show/);
  assert.match(rail, /sidebar\.hide/);
  assert.match(rail, /href="\/docs"/);
  assert.match(rail, /aria-expanded=\{panelOpen\}/);
  assert.match(rail, /aria-controls=\{panelId\}/);
  assert.match(rail, /data-testid="sidebar-panel-toggle"/);
  assert.match(sidebar, /id="desktop-sidebar-panel"/);
  assert.match(sidebar, /window\.requestAnimationFrame\(\(\) => mobileToggleRef\.current\?\.focus\(\)\)/);
  assert.match(sidebar, /closeMobileNavigation\(false\)/);
  assert.match(panel, /sidebar\.hide/);
  assert.match(panel, /PanelLeftClose/);
});

test("sidebar rail uses compact labeled navigation while keeping Spaces in an optional drawer", () => {
  const sidebar = read("src/components/layout/sidebar.tsx");
  const rail = read("src/components/layout/sidebar/rail.tsx");
  const translations = read("src/lib/i18n/translations.ts");

  assert.match(sidebar, /useState\(false\)/);
  assert.match(sidebar, /w-\[64px\]/);
  assert.match(rail, /bg-\[#16132f\]/);
  assert.match(rail, /min-h-\[48px\]/);
  assert.match(rail, /sidebar-rail-item-label/);
  assert.match(rail, /whitespace-normal/);
  assert.match(rail, /overflow-wrap:anywhere/);
  assert.doesNotMatch(rail, /truncate/);
  assert.match(translations, /"sidebar\.show": "Show sidebar"/);
  assert.match(translations, /"sidebar\.show": "Mostrar sidebar"/);

  const brandIndex = rail.indexOf('data-testid="sidebar-rail-brand"');
  const toggleIndex = rail.indexOf('data-testid="sidebar-panel-toggle"');
  const navigationIndex = rail.indexOf('data-testid="sidebar-rail-navigation"');
  assert.ok(
    brandIndex >= 0 &&
      brandIndex < toggleIndex &&
      toggleIndex < navigationIndex,
  );
  assert.match(rail, /mt-1 flex h-8 w-full shrink-0 items-center justify-center/);
});

test("empty workspaces teach setup steps and permission boundaries", () => {
  const page = read("src/app/(dashboard)/page.tsx");
  const summaryRoute = read("src/app/api/dashboard/summary/route.ts");
  const onboarding = read("src/components/dashboard/first-run-onboarding.tsx");
  const panel = read("src/components/layout/sidebar/panel.tsx");
  const translations = read("src/lib/i18n/translations.ts");

  assert.match(page, /components\/dashboard\/first-run-onboarding/);
  assert.match(page, /<FirstRunOnboarding\s/);
  assert.match(summaryRoute, /workspace_setup/);
  assert.match(summaryRoute, /prisma\.space\.count/);
  assert.match(summaryRoute, /prisma\.workspaceMember\.count/);
  assert.match(onboarding, /onboarding\.modelWorkspace/);
  assert.match(onboarding, /onboarding\.roleHintViewer/);
  assert.doesNotMatch(onboarding, /onboarding\.stepSpaceAction/);
  assert.match(onboarding, /onboarding\.stepSpaceBodyViewOnly/);
  assert.match(onboarding, /requiresWorkspaceAdmin: true/);
  assert.match(onboarding, /!canManageWorkspace && Boolean\(step\.requiresWorkspaceAdmin\)/);
  assert.match(onboarding, /const isInteractive = !disabled && !step\.complete/);
  assert.match(panel, /sidebar\.noSpacesHint/);
  assert.match(panel, /sidebar\.noSpacesViewOnly/);
  assert.match(panel, /canManageWorkspace \? \(/);
  assert.match(translations, /Workspace = company\/account environment/);
  assert.match(translations, /Acesso somente leitura/);
});

test("sidebar search queries the server and includes parent context for folder matches", () => {
  const panel = read("src/components/layout/sidebar/panel.tsx");
  const panelData = read("src/components/layout/sidebar/use-panel-data.ts");
  const sidebarRoute = read("src/app/api/sidebar/route.ts");
  const sidebarDiscovery = read("src/lib/sidebar-discovery.ts");
  const workspaceTreeRoute = read("src/app/api/workspace-tree/route.ts");

  assert.match(panel, /loadPanel\(\{ force: isSearching, query: sidebarQuery\.trim\(\) \}\)/);
  assert.match(panelData, /const NAVIGATION_ENDPOINT = "\/api\/workspace-tree"/);
  assert.match(panelData, /\$\{NAVIGATION_ENDPOINT\}\?q=\$\{encodeURIComponent\(normalizedQuery\)\}&limit=500/);
  assert.doesNotMatch(panelData, /fetch\("\/api\/sidebar"\)/);
  assert.match(workspaceTreeRoute, /export \{ GET \} from "@\/app\/api\/sidebar\/route"/);
  assert.match(panelData, /panelLoadFailed/);
  assert.match(panel, /sidebar\.navigationUnavailable/);
  assert.match(sidebarRoute, /loadSidebarFolderContext\(/);
  assert.match(sidebarRoute, /matchingProjects\.map\(\(project\) => project\.folder_id\)/);
  assert.match(sidebarRoute, /projectPage\.items\.map\(\(project\) => project\.folder_id\)/);
  assert.match(sidebarDiscovery, /pendingFolderIds\.size > 0/);
  assert.match(sidebarRoute, /for \(const folder of folderById\.values\(\)\) spaceIds\.add\(folder\.space_id\)/);
});

test("workspace sidebar list clicks open the selected list directly", () => {
  const projectRow = read("src/components/layout/sidebar/project-row.tsx");
  const spaceTree = read("src/components/layout/sidebar/space-tree.tsx");

  assert.match(projectRow, /href=\{href \?\? `\/projects\/\$\{project\.id\}`\}/);
  const directListHrefs = spaceTree.match(/href=\{`\/projects\/\$\{p\.id\}`\}/g) ?? [];
  assert.equal(directListHrefs.length, 2);
  assert.doesNotMatch(spaceTree, /tab=browse&list=/);
  assert.doesNotMatch(spaceTree, /\/folders\/\$\{f\.id\}\?list=/);
});
