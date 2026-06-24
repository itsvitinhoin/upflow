import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const ROOT = join(__dirname, "..", "..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

test("CRUD QA checklist covers every rollout module and verification gate", () => {
  const checklistPath = join(ROOT, "docs/crud-qa-checklist.md");
  assert.equal(existsSync(checklistPath), true);

  const checklist = read("docs/crud-qa-checklist.md");
  const modules = [
    "Spaces",
    "Folders",
    "Lists/projects",
    "Tasks",
    "Clients",
    "Calendar events",
    "Notes",
    "Contacts",
    "Team members",
    "Departments",
  ];
  const checks = [
    "Can I create it?",
    "Can I edit it?",
    "Can I delete it?",
    "Does it persist after reload?",
    "Does the UI show loading, success, and error feedback?",
    "Does it block invalid input?",
    "Does it block unauthorized users?",
  ];

  for (const moduleName of modules) {
    assert.match(checklist, new RegExp(`\\| ${moduleName.replace("/", "\\/")} \\|`));
  }

  for (const check of checks) {
    assert.match(checklist, new RegExp(check.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.match(checklist, /Unauthorized Access Checks/);
  assert.match(checklist, /Invalid Input Checks/);
  assert.match(checklist, /Do not mark a row passed unless it was tested with real production data/i);
});

test("client notes and contacts expose scoped edit/delete API routes", () => {
  const routeFiles = [
    "src/app/api/companies/[id]/contacts/[contactId]/route.ts",
    "src/app/api/companies/[id]/notes/[noteId]/route.ts",
  ];

  for (const routeFile of routeFiles) {
    const content = read(routeFile);
    assert.match(content, /export const PATCH/);
    assert.match(content, /export const DELETE/);
    assert.match(content, /workspace_id/);
    assert.match(content, /Workspace admin access required/);
  }
});
