import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = join(__dirname, "..", "..");

function read(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

function unguardedDarkBackgrounds(source: string) {
  return source
    .split("\n")
    .map((line, index) => ({ line, lineNumber: index + 1 }))
    .filter(({ line }) => /bg-\[#0[0-9a-f]/i.test(line) && !/dark:bg-\[#0[0-9a-f]/i.test(line));
}

test("performance mode remains palette-neutral in light mode", () => {
  const theme = read("src/app/theme.css");
  const performanceSkin = theme.slice(theme.indexOf("/* Performance skin */"));
  const neutralSurfaceBlock = performanceSkin.match(
    /body\.upflow-performance \.glass,[\s\S]*?\n\}/,
  )?.[0];

  assert.ok(neutralSurfaceBlock, "expected the shared performance surface block");
  assert.doesNotMatch(neutralSurfaceBlock, /background\s*:/);
  assert.doesNotMatch(neutralSurfaceBlock, /color\s*:/);
  assert.match(performanceSkin, /html\.dark body\.upflow-performance \.glass,/);
  assert.match(performanceSkin, /html\.dark body\.upflow-performance \.upflow-kanban-column/);
  assert.match(performanceSkin, /html\.light body\.upflow-performance \.glass,/);
  assert.match(performanceSkin, /html\.light body\.upflow-performance \.upflow-kanban-column/);
});

test("saved and system themes resolve before and after hydration", () => {
  const layout = read("src/app/layout.tsx");
  const provider = read("src/components/theme-provider.tsx");
  const providers = read("src/components/providers.tsx");

  assert.match(layout, /localStorage\.getItem\("upflow\.theme"\)/);
  assert.match(layout, /id="upflow-theme-initializer"/);
  assert.match(layout, /root\.classList\.add\(resolved\)/);
  assert.match(provider, /resolvedTheme/);
  assert.match(provider, /matchMedia\("\(prefers-color-scheme: dark\)"\)/);
  assert.match(provider, /addEventListener\("change", onChange\)/);
  assert.match(providers, /theme=\{resolvedTheme\}/);
});

test("critical light-mode surfaces do not use unguarded dark hex backgrounds", () => {
  const criticalFiles = [
    "src/components/projects/project-toolbar.tsx",
    "src/components/projects/kanban-board.tsx",
    "src/app/(dashboard)/projects/[id]/page.tsx",
    "src/components/layout/header.tsx",
    "src/components/layout/workspace-switcher.tsx",
    "src/components/onboarding/finance-onboarding-form.tsx",
    "src/components/onboarding/marketing-b2c-onboarding-form.tsx",
    "src/components/onboarding/client-onboarding-panel.tsx",
    "src/components/dashboard/create-company-dialog.tsx",
  ];

  const failures = criticalFiles.flatMap((file) =>
    unguardedDarkBackgrounds(read(file)).map(({ line, lineNumber }) =>
      `${file}:${lineNumber}: ${line.trim()}`,
    ),
  );

  assert.deepEqual(failures, []);
});
