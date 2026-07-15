import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const ROOT = join(__dirname, "..", "..");

test("header search keeps a native navigation fallback before hydration", () => {
  const header = readFileSync(join(ROOT, "src/components/layout/header.tsx"), "utf8");

  assert.match(header, /<form[\s\S]*action="\/search"[\s\S]*method="get"/);
  assert.match(header, /type="search"[\s\S]*name="q"/);
  assert.match(header, /router\.push\(`\/search\?q=\$\{encodeURIComponent\(search\.trim\(\)\)\}`\)/);
});
