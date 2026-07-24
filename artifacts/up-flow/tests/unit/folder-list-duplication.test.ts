import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = join(__dirname, "..", "..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

test("folder and list duplication preserves reusable work without restarting onboarding", () => {
  const helper = read("src/lib/project-duplicate.ts");
  const projectRoute = read("src/app/api/projects/[id]/duplicate/route.ts");
  const folderRoute = read("src/app/api/folders/[id]/duplicate/route.ts");
  const projectRow = read("src/components/layout/sidebar/project-row.tsx");
  const spaceTree = read("src/components/layout/sidebar/space-tree.tsx");
  const translations = read("src/lib/i18n/translations.ts");

  assert.match(helper, /export async function duplicateProject/);
  assert.match(helper, /name: await nextProjectCopyName/);
  assert.match(helper, /onboarding_enabled: false/);
  assert.match(helper, /sidebar_hidden: false/);
  assert.match(helper, /fieldIdBySourceId/);
  assert.match(helper, /custom_field_values/);
  assert.match(helper, /workflow_statuses/);
  assert.match(helper, /project_members/);
  assert.match(helper, /taskIdBySourceId/);
  assert.match(helper, /parent_id: task\.parent_id \? taskIdBySourceId\.get\(task\.parent_id\)/);
  assert.match(helper, /export async function duplicateFolder/);
  assert.match(helper, /getDescendantFolderIds/);
  assert.match(helper, /await duplicateProject\(tx/);
  assert.match(helper, /position: root \? \(lastSibling\?\.position \?\? -1\) \+ 1/);

  assert.match(projectRoute, /isWorkspaceAdminFor\(auth, source\.workspace_id\)/);
  assert.match(projectRoute, /duplicateProject\(tx/);
  assert.match(projectRoute, /type: "project_duplicated"/);
  assert.match(folderRoute, /isWorkspaceAdminFor\(auth, source\.workspace_id\)/);
  assert.match(folderRoute, /duplicateFolder\(tx/);
  assert.match(folderRoute, /type: "folder_duplicated"/);

  assert.match(projectRow, /fetch\(`\/api\/projects\/\$\{project\.id\}\/duplicate`/);
  assert.match(projectRow, /<Copy className=/);
  assert.match(spaceTree, /handleDuplicateFolder/);
  assert.match(spaceTree, /<Copy className=/);
  assert.match(translations, /"common\.duplicate": "Duplicate"/);
  assert.match(translations, /"projects\.duplicated": "Project duplicated"/);
  assert.match(translations, /"sidebar\.folderDuplicated": "Folder duplicated"/);
});
