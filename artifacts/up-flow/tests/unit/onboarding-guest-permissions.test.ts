import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = join(__dirname, "..", "..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

test("guests remain read-only for onboarding work even when stale records assign them", () => {
  const access = read("src/lib/onboarding.ts");
  const formRoutes = [
    read("src/app/api/onboarding/finance-form/[taskId]/route.ts"),
    read("src/app/api/onboarding/support-form/[taskId]/route.ts"),
    read("src/app/api/onboarding/marketing-b2b-form/[taskId]/route.ts"),
    read("src/app/api/onboarding/marketing-b2c-form/[taskId]/route.ts"),
  ];

  assert.match(access, /const canWork = admin \|\| Boolean\(member && member\.role !== "guest"\)/);
  assert.match(access, /const isFinance =\s*canWork &&/);
  assert.match(access, /const isSupport =\s*canWork &&/);
  assert.match(access, /const isCommercial =\s*canWork &&/);
  assert.match(access, /const serviceNames = canWork/);
  assert.match(access, /canWork,/);
  assert.match(access, /canUpdateService\([^)]*\) \{\s*if \(!canWork\) return false;/);
  assert.match(access, /canUpdateChecklistItem\([^)]*\) \{\s*if \(!canWork\) return false;/);

  for (const route of formRoutes) {
    assert.match(route, /onboardingAccess\.canWork && Boolean\(/);
    assert.match(route, /if \(!access\.canEdit\)/);
  }
});
