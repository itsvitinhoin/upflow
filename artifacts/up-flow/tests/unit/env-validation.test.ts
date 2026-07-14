import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const envSource = readFileSync(new URL("../../src/lib/env.ts", import.meta.url), "utf8");
const instrumentationSource = readFileSync(
  new URL("../../src/instrumentation.ts", import.meta.url),
  "utf8",
);
const healthSource = readFileSync(
  new URL("../../src/app/api/health/route.ts", import.meta.url),
  "utf8",
);

test("production env validation runs at server startup and request time, not module import", () => {
  assert.doesNotMatch(envSource, /\nvalidateEnv\(\);\s*$/);
  assert.match(
    instrumentationSource,
    /const \{ validateEnv \} = await import\("@\/lib\/env"\);\s+validateEnv\(\);/,
  );
  assert.match(healthSource, /const env = validateEnv\(\);/);
});
