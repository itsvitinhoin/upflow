import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const departmentSpacesSource = readFileSync(
  join(root, "src/lib/department-spaces.ts"),
  "utf8",
);

test("department space presets include all requested departments with emojis and starter lists", () => {
  const expected = [
    ["💼", "Comercial", "Leads", "Proposals", "Follow-ups", "Contracts"],
    ["🎯", "Marketing B2B", "Campaigns", "LinkedIn & Outbound", "Landing Pages", "Reports"],
    ["📣", "Marketing B2C", "Campaigns", "Content Calendar", "Ads", "Promotions"],
    ["🎨", "Creative & Design", "Design Queue", "Creative Reviews", "Brand Assets", "Approvals"],
    ["💰", "Finance", "Invoices", "Payments", "Commissions", "Expenses"],
    ["🎬", "Production", "Shoots", "Editing", "Publishing", "Deliverables"],
    ["⚙️", "General Admin", "Internal Requests", "Access & Accounts", "Documents", "Vendors"],
  ];

  for (const values of expected) {
    for (const value of values) {
      assert.ok(departmentSpacesSource.includes(value), `missing ${value}`);
    }
  }

  for (const value of [
    "Technical Support",
    "Support Tickets",
    "Bug Reports",
    "Access Issues",
    "Client Requests",
    "Resolved",
  ]) {
    assert.ok(departmentSpacesSource.includes(value), `missing ${value}`);
  }
});

test("General Admin includes the RH folder and ClickUp-style RH board model", () => {
  const rhBoardSource = readFileSync(join(root, "src/lib/rh-board.ts"), "utf8");

  for (const value of [
    "starter_folders",
    "RH",
    "ensureDepartmentListModel",
    "prisma.folder.create",
    "workflowStatus.create",
  ]) {
    assert.ok(departmentSpacesSource.includes(value), `missing ${value}`);
  }

  for (const value of [
    "BOAS VINDAS",
    "RH Status",
    "RH Task Type",
    "EM TREINAMENTO",
    "PONTO DE ATENCAO",
    "ANIVERSARIANTES",
    "PLANO DE CARREIRA",
    "STEFAN",
    "THIAGO",
    "FEEDBACKS",
    "DESLIGAMENTO",
    "ASSINATURA DO CONTRATO",
  ]) {
    assert.ok(rhBoardSource.includes(value), `missing ${value}`);
  }
});

test("department setup is idempotent but not auto-seeded into personal workspace load paths", () => {
  assert.match(departmentSpacesSource, /normalizeDepartmentSpaceName/);
  assert.match(departmentSpacesSource, /spacesByName\.get/);
  assert.match(departmentSpacesSource, /missingLists/);
  assert.match(departmentSpacesSource, /prisma\.space\.create/);
  assert.match(departmentSpacesSource, /prisma\.project\.createMany/);

  const workspaceRoute = readFileSync(join(root, "src/app/api/workspaces/route.ts"), "utf8");
  const workspaceLib = readFileSync(join(root, "src/lib/workspace.ts"), "utf8");
  const sidebarRoute = readFileSync(join(root, "src/app/api/sidebar/route.ts"), "utf8");

  assert.doesNotMatch(workspaceRoute, /ensureDepartmentSpaces\(workspace\.id/);
  assert.doesNotMatch(workspaceLib, /ensureDepartmentSpaces\(workspace\.id/);
  assert.doesNotMatch(sidebarRoute, /ensureDepartmentSpaces\(auth\.currentWorkspaceId/);
});

test("space dashboards and department task creation use department presets", () => {
  const dashboardRoute = readFileSync(
    join(root, "src/app/api/spaces/[id]/dashboard/route.ts"),
    "utf8",
  );
  const spacePage = readFileSync(
    join(root, "src/app/(dashboard)/spaces/[id]/page.tsx"),
    "utf8",
  );

  assert.match(dashboardRoute, /getDepartmentSpacePreset/);
  assert.match(dashboardRoute, /department_preset/);
  assert.match(spacePage, /dashboard_focus_labels/);
  assert.match(spacePage, /default_task_template_id/);
});

test("RH board fields drive project board columns and setup refresh", () => {
  const kanbanBoard = readFileSync(join(root, "src/components/projects/kanban-board.tsx"), "utf8");
  const projectPage = readFileSync(join(root, "src/app/(dashboard)/projects/[id]/page.tsx"), "utf8");
  const spacePage = readFileSync(join(root, "src/app/(dashboard)/spaces/[id]/page.tsx"), "utf8");
  const defaultsRoute = readFileSync(
    join(root, "src/app/api/spaces/[id]/department-defaults/route.ts"),
    "utf8",
  );

  assert.match(kanbanBoard, /RH_BOARD_FIELD_NAME/);
  assert.match(kanbanBoard, /custom-fields/);
  assert.match(kanbanBoard, /addTaskToColumn/);
  assert.match(projectPage, /initialCustomFieldValues/);
  assert.match(spacePage, /department-defaults/);
  assert.match(defaultsRoute, /ensureDepartmentSpaces/);
  assert.match(defaultsRoute, /isWorkspaceAdminFor/);
});
