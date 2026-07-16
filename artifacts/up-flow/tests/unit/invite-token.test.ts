import assert from "node:assert/strict";
import test from "node:test";
import {
  INVITE_TTL_MS,
  generateInviteToken,
  hashInviteToken,
  inviteExpiry,
  isInviteExpired,
  maskInviteEmail,
} from "../../src/lib/invite-token";

test("invite tokens are high-entropy, hashable, and never equal their hash", () => {
  const token = generateInviteToken();
  const hash = hashInviteToken(token);
  assert.match(token, /^[A-Za-z0-9_-]{32,}$/);
  assert.ok(hash);
  assert.notEqual(hash, token);
  assert.equal(hash, hashInviteToken(token));
  assert.equal(hashInviteToken("invalid token"), null);
});

test("invite expiry is seven days and expired tokens cannot be reused", () => {
  const now = new Date("2026-07-16T12:00:00.000Z");
  const expiry = inviteExpiry(now);
  assert.equal(expiry.getTime() - now.getTime(), INVITE_TTL_MS);
  assert.equal(isInviteExpired(expiry, new Date(expiry.getTime() - 1)), false);
  assert.equal(isInviteExpired(expiry, expiry), true);
});

test("public invite previews mask email addresses", () => {
  assert.equal(maskInviteEmail("alex@example.com"), "al**@example.com");
  assert.equal(maskInviteEmail("a@example.com"), "a*@example.com");
});
