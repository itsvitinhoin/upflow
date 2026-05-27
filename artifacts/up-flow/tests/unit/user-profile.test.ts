import assert from "node:assert/strict";
import test from "node:test";
import {
  isPhoneLikeName,
  normalizeDisplayName,
  normalizePhone,
} from "../../src/lib/user-profile";

test("profile normalization keeps names and phones separate", () => {
  assert.equal(normalizePhone("  +55 11 99999-9999  "), "+55 11 99999-9999");
  assert.equal(isPhoneLikeName("+55 11 99999-9999"), true);
  assert.equal(isPhoneLikeName("Alex Johnson"), false);
  assert.equal(
    normalizeDisplayName("Alex Johnson", "alex@example.com", "+55 11 99999-9999"),
    "Alex Johnson",
  );
  assert.equal(
    normalizeDisplayName("+55 11 99999-9999", "alex@example.com", "+55 11 99999-9999"),
    "alex",
  );
});
