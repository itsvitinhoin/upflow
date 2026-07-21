import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  addBusinessDaysToIsoDate,
  buildCreativeBriefingDescription,
  buildCreativeBriefingTitle,
} from "../../src/lib/creative-briefing";
import { parseTaskBrief } from "../../src/lib/task-templates";

const ROOT = join(__dirname, "..", "..");

function read(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

test("creative briefing descriptions stay parseable as normal UP Flow task briefs", () => {
  const description = buildCreativeBriefingDescription({
    designerName: "Ana Designer",
    brandName: "Acme",
    videoSize: "9:16 - 1080 x 1920",
    format: "Carousel",
    brandRules: "Predefined",
    driveUrl: "https://drive.example.com/folder",
    visualReferenceUrl: "https://example.com/reference",
    referenceFileName: "reference.pdf",
    referenceFileUrl: "task-asset://workspace/task/reference.pdf",
    priority: "medium",
    dueDate: "2026-07-24",
    estimatedHours: 2,
  });

  const parsed = parseTaskBrief(description);
  assert.equal(parsed?.type, "Creative briefing");
  assert.ok(parsed?.details.some((item) => item.label === "Designer" && item.value === "Ana Designer"));
  assert.ok(parsed?.details.some((item) => item.label === "Reference file link"));
  assert.ok((parsed?.checklist.length ?? 0) >= 4);
  assert.equal(buildCreativeBriefingTitle("Acme", "Carousel"), "Creative briefing: Acme - Carousel");
});

test("creative briefing deadlines skip weekends", () => {
  const friday = new Date(2026, 6, 17);
  assert.equal(addBusinessDaysToIsoDate(friday, 1), "2026-07-20");
  assert.equal(addBusinessDaysToIsoDate(friday, 2), "2026-07-21");
});

test("Design Queue receives a Forms view and secured reference upload flow", () => {
  const projectPage = read("src/app/(dashboard)/projects/[id]/page.tsx");
  const toolbar = read("src/components/projects/project-toolbar.tsx");
  const tasksRoute = read("src/app/api/tasks/route.ts");
  const referenceRoute = read("src/app/api/tasks/[id]/creative-reference/route.ts");
  const assetsRoute = read("src/app/api/task-assets/[...path]/route.ts");

  assert.match(projectPage, /isDesignQueueProject/);
  assert.match(projectPage, /CreativeBriefingForm/);
  assert.match(projectPage, /enableForms=\{isDesignQueue\}/);
  assert.match(toolbar, /view: "list" \| "board" \| "form"/);
  assert.match(toolbar, /toolbar\.forms/);
  assert.match(tasksRoute, /company_id\?: string \| null/);
  assert.match(tasksRoute, /Tasks in a client project must stay linked to that client/);
  assert.match(referenceRoute, /MAX_REFERENCE_BYTES = 20 \* 1024 \* 1024/);
  assert.match(referenceRoute, /application\/pdf/);
  assert.match(referenceRoute, /canContributeToProject/);
  assert.match(assetsRoute, /description: \{ contains: reference \}/);
});
