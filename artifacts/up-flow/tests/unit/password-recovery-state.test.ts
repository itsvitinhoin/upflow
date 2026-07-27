import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createPasswordRecoveryState,
  createPasswordRecoveryStateConfirmationUrl,
  PASSWORD_RECOVERY_STATE_TTL_SECONDS,
  readPasswordRecoveryState,
  readPasswordRecoveryTokenHash,
} from "../../src/lib/supabase/recovery-state";

const appOrigin = "https://app.example";
const secret = "service-role-key";
const tokenHash = "one-time-token-hash";
const now = Date.UTC(2026, 6, 27, 12, 0, 0);

test("uses an opaque, encrypted state in custom recovery emails", () => {
  const confirmationUrl = createPasswordRecoveryStateConfirmationUrl({
    appOrigin,
    tokenHash,
    secret,
    now,
  });
  const parsed = new URL(confirmationUrl);
  const state = parsed.searchParams.get("state");

  assert.equal(parsed.origin, appOrigin);
  assert.equal(parsed.pathname, "/auth/reset/confirm");
  assert.ok(state);
  assert.ok(!confirmationUrl.includes(tokenHash), "email URL must not expose the Supabase recovery token");
  assert.deepEqual(readPasswordRecoveryState({ state: state ?? "", secret, now }), {
    version: 2,
    purpose: "password-recovery",
    audience: appOrigin,
    tokenHash,
    expiresAt: Math.floor(now / 1000) + PASSWORD_RECOVERY_STATE_TTL_SECONDS,
  });
});

test("uses a fresh ciphertext for each otherwise identical recovery state", () => {
  const first = createPasswordRecoveryState({ appOrigin, tokenHash, secret, now });
  const second = createPasswordRecoveryState({ appOrigin, tokenHash, secret, now });

  assert.notEqual(first, second);
  assert.equal(readPasswordRecoveryState({ state: first, secret, now })?.tokenHash, tokenHash);
  assert.equal(readPasswordRecoveryState({ state: second, secret, now })?.tokenHash, tokenHash);
});

test("rejects altered, expired, wrongly keyed, and malformed-token recovery state", () => {
  const state = createPasswordRecoveryState({ appOrigin, tokenHash, secret, now });
  const altered = `${state[0]}${state[1] === "A" ? "B" : "A"}${state.slice(2)}`;
  const malformedToken = createPasswordRecoveryState({
    appOrigin,
    tokenHash: "not valid",
    secret,
    now,
  });

  assert.equal(readPasswordRecoveryState({ state: altered, secret, now }), null);
  assert.equal(readPasswordRecoveryState({ state, secret: "wrong-secret", now }), null);
  assert.equal(readPasswordRecoveryState({ state: malformedToken, secret, now }), null);
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
        appOrigin,
        tokenHash: `${tokenHash}${"x".repeat(paddingLength)}`,
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

test("only resolves a state for its intended app origin", () => {
  const state = createPasswordRecoveryState({ appOrigin, tokenHash, secret, now });

  assert.equal(
    readPasswordRecoveryTokenHash({ state, secret, expectedAppOrigin: appOrigin, now }),
    tokenHash,
  );
  assert.equal(
    readPasswordRecoveryTokenHash({
      state,
      secret,
      expectedAppOrigin: "https://other.example",
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
