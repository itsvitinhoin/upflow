import assert from "node:assert/strict";
import test from "node:test";
import { safeInternalPath } from "../../src/lib/safe-internal-path";

test("safeInternalPath preserves normal internal destinations", () => {
  assert.equal(safeInternalPath("/invite/abc?next=1#details"), "/invite/abc?next=1#details");
});

test("safeInternalPath rejects external and encoded redirect escapes", () => {
  assert.equal(safeInternalPath("https://evil.example"), "/");
  assert.equal(safeInternalPath("//evil.example"), "/");
  assert.equal(safeInternalPath("/%2f%2fevil.example"), "/");
  assert.equal(safeInternalPath("/\\evil.example"), "/");
});
