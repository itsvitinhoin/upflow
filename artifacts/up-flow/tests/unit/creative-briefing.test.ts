import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  addBusinessDaysToIsoDate,
  buildCreativeBriefingDescription,
  buildCreativeBriefingTitle,
  filterCreativeBriefingDesigners,
} from "../../src/lib/creative-briefing";
import { parseTaskBrief } from "../../src/lib/task-templates";

const ROOT = join(__dirname, "..", "..");

function read(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

test("creative briefing descriptions stay parseable as normal UP Flow task briefs", () => {
  const description = buildCreativeBriefingDescription({
    designerNames: ["Ana Designer", "Rafael Motion"],
    requesterName: "Paula Requester",
    brandName: "Acme",
    videoSizes: ["9:16 - 1080 x 1920", "1:1 - 1080 x 1080"],
    formats: ["Carousel", "Video edit"],
    brandRules: "Use the current campaign color palette.",
    description: "Create the launch assets for the August campaign.",
    driveUrl: "https://drive.example.com/folder",
    driveFiles: [
      {
        name: "brand-assets.pdf",
        url: "task-asset://workspace/task/brand-assets.pdf",
      },
    ],
    visualReferenceUrl: "https://example.com/reference",
    referenceFileName: "reference.pdf",
    referenceFileUrl: "task-asset://workspace/task/reference.pdf",
    priority: "medium",
    dueDate: "2026-07-24",
    estimatedHours: 2,
  });

  const parsed = parseTaskBrief(description);
  assert.equal(parsed?.type, "Creative briefing");
  assert.ok(
    parsed?.details.some(
      (item) => item.label === "Designers" && item.value === "Ana Designer, Rafael Motion",
    ),
  );
  assert.ok(
    parsed?.details.some((item) => item.label === "Requester" && item.value === "Paula Requester"),
  );
  assert.ok(
    parsed?.details.some(
      (item) => item.label === "Formats" && item.value === "Carousel, Video edit",
    ),
  );
  assert.ok(
    parsed?.details.some(
      (item) =>
        item.label === "Description" && item.value === "Create the launch assets for the August campaign.",
    ),
  );
  assert.ok(
    parsed?.details.some(
      (item) => item.label === "Drive / photos file" && item.value === "brand-assets.pdf",
    ),
  );
  assert.ok(parsed?.details.some((item) => item.label === "Drive / photos file link"));
  assert.ok(parsed?.details.some((item) => item.label === "Reference file link"));
  assert.ok((parsed?.checklist.length ?? 0) >= 4);
  assert.equal(buildCreativeBriefingTitle("Acme", "Carousel"), "Creative briefing: Acme - Carousel");
});

test("creative briefing deadlines skip weekends", () => {
  const friday = new Date(2026, 6, 17);
  assert.equal(addBusinessDaysToIsoDate(friday, 1), "2026-07-20");
  assert.equal(addBusinessDaysToIsoDate(friday, 2), "2026-07-21");
});

test("creative briefing only offers Creative & Design members as designers", () => {
  const designers = filterCreativeBriefingDesigners([
    { id: "creative", name: "Ana", email: "ana@example.com", department_name: "Creative & Design" },
    { id: "criativos", name: "Bruno", email: "bruno@example.com", department_name: "Criativos & Design" },
    { id: "commercial", name: "Carla", email: "carla@example.com", department_name: "Commercial" },
    { id: "none", name: "Diego", email: "diego@example.com", department_name: null },
  ]);

  assert.deepEqual(designers.map((member) => member.id), ["creative", "criativos"]);
});

test("Design Queue receives a Forms view and secured reference upload flow", () => {
  const projectPage = read("src/app/(dashboard)/projects/[id]/page.tsx");
  const toolbar = read("src/components/projects/project-toolbar.tsx");
  const board = read("src/components/projects/kanban-board.tsx");
  const form = read("src/components/projects/creative-briefing-form.tsx");
  const taskDetail = read("src/components/projects/task-detail-sheet.tsx");
  const tasksRoute = read("src/app/api/tasks/route.ts");
  const referenceRoute = read("src/app/api/tasks/[id]/creative-reference/route.ts");
  const assetsRoute = read("src/app/api/task-assets/[...path]/route.ts");

  assert.match(projectPage, /isDesignQueueProject/);
  assert.match(projectPage, /CreativeBriefingForm/);
  assert.match(projectPage, /enableForms=\{isDesignQueue\}/);
  assert.match(projectPage, /showBriefingDetails=\{isDesignQueue\}/);
  assert.match(toolbar, /view: "list" \| "board" \| "form"/);
  assert.match(toolbar, /toolbar\.forms/);
  assert.match(board, /parseTaskBrief/);
  assert.match(board, /isCreativeBriefingType/);
  assert.match(board, /showBriefingDetails/);
  assert.match(form, /function MultiSelectField/);
  assert.match(form, /type="checkbox"/);
  assert.match(form, /filterCreativeBriefingDesigners/);
  assert.match(form, /creativeBrief\.requester/);
  assert.doesNotMatch(form, /setDesignerIds\(\[me\.id\]\)/);
  assert.match(form, /creativeBrief\.description/);
  assert.match(form, /referenceImagePreview/);
  assert.match(form, /driveFiles/);
  assert.match(form, /multiple/);
  assert.match(form, /asset_role/);
  assert.match(form, /setDeadlinePreset\(preset\)/);
  assert.match(tasksRoute, /company_id\?: string \| null/);
  assert.match(tasksRoute, /Tasks in a client project must stay linked to that client/);
  assert.match(referenceRoute, /MAX_REFERENCE_BYTES = 20 \* 1024 \* 1024/);
  assert.match(referenceRoute, /application\/pdf/);
  assert.match(referenceRoute, /assetRoleValue/);
  assert.match(referenceRoute, /drive_file/);
  assert.match(referenceRoute, /canContributeToProject/);
  assert.match(assetsRoute, /description: \{ contains: reference \}/);
  assert.match(taskDetail, /structuredBrief\.details\.slice\(0, 24\)/);
});
