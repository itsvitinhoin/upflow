import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createPasswordRecoveryConfirmationUrl,
  getPasswordRecoveryActionLink,
} from "../../src/lib/supabase/recovery-link";

const appOrigin = "https://app.example";
const supabaseUrl = "https://project.supabase.test";
const redirectTo = `${appOrigin}/auth/reset`;

function actionLink(overrides: Record<string, string> = {}) {
  const params = new URLSearchParams({
    token: "one-time-token",
    type: "recovery",
    redirect_to: redirectTo,
    ...overrides,
  });
  return `${supabaseUrl}/auth/v1/verify?${params}`;
}

test("moves a Supabase action link into an app-local URL fragment", () => {
  const action = actionLink();
  const confirmation = createPasswordRecoveryConfirmationUrl({ appOrigin, actionLink: action });
  const parsed = new URL(confirmation);

  assert.equal(parsed.origin, appOrigin);
  assert.equal(parsed.pathname, "/auth/reset/confirm");
  assert.match(parsed.hash, /^#action=/);
  assert.ok(!confirmation.includes(action), "the raw one-time link must not be in the email URL");
  assert.equal(
    getPasswordRecoveryActionLink({
      hash: parsed.hash,
      supabaseUrl,
      expectedRedirectTo: redirectTo,
    }),
    action,
  );
});

test("rejects confirmation links that are not this app's recovery callback", () => {
  const cases = [
    actionLink({ type: "signup" }),
    actionLink({ redirect_to: "https://attacker.example/auth/reset" }),
    "https://attacker.example/auth/v1/verify?token=one-time-token&type=recovery&redirect_to=https%3A%2F%2Fapp.example%2Fauth%2Freset",
    `${supabaseUrl}/auth/v1/verify?type=recovery&redirect_to=https%3A%2F%2Fapp.example%2Fauth%2Freset`,
  ];

  for (const action of cases) {
    const confirmation = createPasswordRecoveryConfirmationUrl({ appOrigin, actionLink: action });
    assert.equal(
      getPasswordRecoveryActionLink({
        hash: new URL(confirmation).hash,
        supabaseUrl,
        expectedRedirectTo: redirectTo,
      }),
      null,
      `should reject ${action}`,
    );
  }
});

test("confirmation page verifies opaque state after a click, then opens the reset form", () => {
  const page = readFileSync("src/app/auth/reset/confirm/confirm-page.tsx", "utf8");
  const middleware = readFileSync("src/middleware.ts", "utf8");
  assert.match(page, /const recoveryHash = useRef<string \| null>\(null\)/);
  assert.match(page, /const hash = recoveryHash\.current \?\? window\.location\.hash;/);
  assert.match(page, /new URLSearchParams\(window\.location\.search\)\.get\("state"\)/);
  assert.match(page, /hash,\s*supabaseUrl:/);
  assert.match(page, /window\.history\.replaceState\(null, "", window\.location\.pathname\)/);
  assert.match(page, /fetch\("\/api\/auth\/forgot\/continue"/);
  assert.match(page, /credentials: "omit"/);
  assert.match(page, /referrerPolicy: "no-referrer"/);
  assert.match(page, /continuationStarted\.current/);
  assert.match(page, /response\.status === 400/);
  assert.match(page, /setTemporaryError\(true\)/);
  assert.match(page, /supabase\.auth\.verifyOtp\(\{\s*token_hash: payload\.tokenHash,\s*type: "recovery",\s*\}\)/);
  assert.match(page, /window\.location\.replace\("\/auth\/reset\?recovery=1"\)/);
  assert.match(page, /window\.location\.replace\(actionLink\)/);
  assert.match(page, /type="button"/);
  assert.match(middleware, /pathname === "\/auth\/reset\/confirm"/);
  assert.match(middleware, /response\.headers\.set\("Referrer-Policy", "no-referrer"\)/);
  assert.match(middleware, /response\.headers\.set\("Cache-Control", "private, no-store"\)/);
});
