import assert from "node:assert/strict";
import test from "node:test";
import { loadSidebarFolderContext } from "../../src/lib/sidebar-discovery";

type TestFolder = {
  id: string;
  name: string;
  parent_id: string | null;
};

test("visible lists include their hidden folder ancestry without loading unrelated folders", async () => {
  const folders = new Map<string, TestFolder>([
    ["visible-root", { id: "visible-root", name: "Visible root", parent_id: null }],
    ["hidden-leaf", { id: "hidden-leaf", name: "Client work", parent_id: "hidden-parent" }],
    ["hidden-parent", { id: "hidden-parent", name: "Client", parent_id: "hidden-root" }],
    ["hidden-root", { id: "hidden-root", name: "Accounts", parent_id: null }],
    ["unrelated", { id: "unrelated", name: "Private", parent_id: null }],
  ]);
  const calls: string[][] = [];

  const result = await loadSidebarFolderContext(
    [folders.get("visible-root")!],
    ["hidden-leaf", null],
    async (folderIds) => {
      calls.push(folderIds);
      return folderIds.flatMap((folderId) => {
        const folder = folders.get(folderId);
        return folder ? [folder] : [];
      });
    },
  );

  assert.deepEqual(calls, [["hidden-leaf"], ["hidden-parent"], ["hidden-root"]]);
  assert.deepEqual(
    Array.from(result.keys()),
    ["visible-root", "hidden-leaf", "hidden-parent", "hidden-root"],
  );
  assert.equal(result.has("unrelated"), false);
});
