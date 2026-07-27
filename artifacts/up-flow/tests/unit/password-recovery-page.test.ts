import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("consumes a password-recovery callback only once while language state hydrates", () => {
  const page = readFileSync("src/app/auth/reset/page.tsx", "utf8");

  assert.match(page, /const recoveryAttempted = useRef\(false\)/);
  assert.match(page, /if \(recoveryAttempted\.current\) return;/);
  assert.match(
    page,
    /const recoveryLocation = \{\s*search: window\.location\.search,\s*hash: window\.location\.hash,\s*\};/,
  );
  assert.match(page, /establishPasswordRecoverySession\(supabase, recoveryLocation\)/);
  assert.match(page, /new URLSearchParams\(recoveryLocation\.search\)\.get\("recovery"\) === "1"/);
  assert.match(page, /await verifiedRecoverySession\(supabase\)/);
  assert.match(page, /supabase\.auth\.getSession\(\)/);
  assert.match(page, /\}, \[\]\);/);
  assert.doesNotMatch(page, /\}, \[t\]\);/);
});
