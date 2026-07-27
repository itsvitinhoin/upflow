import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createPasswordRecoveryState,
  createPasswordRecoveryStateConfirmationUrl,
  PASSWORD_RECOVERY_STATE_TTL_SECONDS,
  readPasswordRecoveryActionLink,
  readPasswordRecoveryState,
} from "../../src/lib/supabase/recovery-state";

const appOrigin = "https://app.example";
const supabaseUrl = "https://project.supabase.test";
const redirectTo = `${appOrigin}/auth/reset`;
const secret = "service-role-key";
const now = Date.UTC(2026, 6, 27, 12, 0, 0);
const actionLink =
  `${supabaseUrl}/auth/v1/verify?` +
  new URLSearchParams({
    token: "one-time-token",
    type: "recovery",
    redirect_to: redirectTo,
  });

test("uses an opaque, encrypted state in custom recovery emails", () => {
  const confirmationUrl = createPasswordRecoveryStateConfirmationUrl({
    appOrigin,
    actionLink,
    redirectTo,
    secret,
    now,
  });
  const parsed = new URL(confirmationUrl);
  const state = parsed.searchParams.get("state");

  assert.equal(parsed.origin, appOrigin);
  assert.equal(parsed.pathname, "/auth/reset/confirm");
  assert.ok(state);
  assert.ok(!confirmationUrl.includes(actionLink), "email URL must not expose the Supabase bearer URL");
  assert.deepEqual(readPasswordRecoveryState({ state: state ?? "", secret, now }), {
    version: 1,
    purpose: "password-recovery",
    audience: appOrigin,
    actionLink,
    redirectTo,
    expiresAt: Math.floor(now / 1000) + PASSWORD_RECOVERY_STATE_TTL_SECONDS,
  });
});

test("uses a fresh ciphertext for each otherwise identical recovery state", () => {
  const first = createPasswordRecoveryState({ actionLink, redirectTo, secret, now });
  const second = createPasswordRecoveryState({ actionLink, redirectTo, secret, now });

  assert.notEqual(first, second);
  assert.equal(readPasswordRecoveryState({ state: first, secret, now })?.actionLink, actionLink);
  assert.equal(readPasswordRecoveryState({ state: second, secret, now })?.actionLink, actionLink);
});

test("rejects altered, expired, or wrongly keyed recovery state", () => {
  const state = createPasswordRecoveryState({ actionLink, redirectTo, secret, now });
  const altered = `${state[0]}${state[1] === "A" ? "B" : "A"}${state.slice(2)}`;

  assert.equal(readPasswordRecoveryState({ state: altered, secret, now }), null);
  assert.equal(readPasswordRecoveryState({ state, secret: "wrong-secret", now }), null);
  assert.equal(
    readPasswordRecoveryState({
      state,
      secret,
      now: now + (PASSWORD_RECOVERY_STATE_TTL_SECONDS + 1) * 1000,
    }),
    null,
  );
});

test("rejects non-canonical base64url aliases of the same ciphertext", () => {
  const state = [0, 1, 2]
    .map((paddingLength) =>
      createPasswordRecoveryState({
        actionLink: `${actionLink}&padding=${"x".repeat(paddingLength)}`,
        redirectTo,
        secret,
        now,
      }),
    )
    .find((candidate) => candidate.length % 4 !== 0);

  assert.ok(state, "test fixture must have an unpadded base64url tail");
  const alias = nonCanonicalBase64UrlAlias(state);

  assert.notEqual(alias, state);
  assert.deepEqual(Buffer.from(alias, "base64url"), Buffer.from(state, "base64url"));
  assert.equal(readPasswordRecoveryState({ state: alias, secret, now }), null);
});

test("only resolves state into an expected Supabase recovery action URL", () => {
  const state = createPasswordRecoveryState({ actionLink, redirectTo, secret, now });

  assert.equal(
    readPasswordRecoveryActionLink({ state, secret, supabaseUrl, expectedRedirectTo: redirectTo, now }),
    actionLink,
  );
  assert.equal(
    readPasswordRecoveryActionLink({
      state,
      secret,
      supabaseUrl,
      expectedRedirectTo: "https://other.example/auth/reset",
      now,
    }),
    null,
  );
  assert.equal(
    readPasswordRecoveryActionLink({
      state,
      secret,
      supabaseUrl: "https://other.supabase.test",
      expectedRedirectTo: redirectTo,
      now,
    }),
    null,
  );
});

function nonCanonicalBase64UrlAlias(state: string): string {
  const remainder = state.length % 4;
  assert.ok(remainder === 2 || remainder === 3, "state must have unused base64url bits");

  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const lastCharacter = state.at(-1);
  assert.ok(lastCharacter);
  const characterIndex = alphabet.indexOf(lastCharacter);
  assert.notEqual(characterIndex, -1);

  const unusedBitMask = remainder === 2 ? 0b001111 : 0b000011;
  const aliasIndex = (characterIndex & ~unusedBitMask) | ((characterIndex + 1) & unusedBitMask);

  return `${state.slice(0, -1)}${alphabet[aliasIndex]}`;
}
