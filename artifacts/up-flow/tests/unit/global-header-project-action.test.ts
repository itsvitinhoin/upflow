import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (relativePath: string) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

test("the shared header does not mount a global project creation action", () => {
  const header = read("src/components/layout/header.tsx");

  assert.doesNotMatch(header, /NewProjectDialog/);
  assert.doesNotMatch(header, /showNewProject|setShowNewProject/);
  assert.doesNotMatch(header, /hideDefaultPrimaryAction/);
  assert.doesNotMatch(header, /t\("header\.newProject"\)/);
});

test("intentional project creation entry points remain available", () => {
  const directory = read("src/components/projects/project-directory.tsx");
  const spaceTree = read("src/components/layout/sidebar/space-tree.tsx");
  const quickCreate = read("src/app/(dashboard)/page.tsx");

  assert.match(directory, /<NewProjectDialog/);
  assert.match(spaceTree, /t\("sidebar\.newProject"\)/);
  assert.match(
    quickCreate,
    /label: t\("dashboard\.createProject"\), icon: FolderPlus/,
  );
});
