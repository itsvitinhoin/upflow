import assert from "node:assert/strict";
import test from "node:test";
import {
  databaseErrorCode,
  hasInternalHealthAccess,
} from "../../src/lib/health-diagnostics";

test("internal health diagnostics require the exact bearer secret", () => {
  assert.equal(hasInternalHealthAccess("Bearer correct-secret", "correct-secret"), true);
  assert.equal(hasInternalHealthAccess("Bearer wrong-secret", "correct-secret"), false);
  assert.equal(hasInternalHealthAccess(null, "correct-secret"), false);
  assert.equal(hasInternalHealthAccess("Bearer correct-secret", undefined), false);
});

test("database diagnostics expose only Prisma-style error codes", () => {
  assert.equal(databaseErrorCode({ code: "P1000" }), "P1000");
  assert.equal(databaseErrorCode({ errorCode: "P1001" }), "P1001");
  assert.equal(databaseErrorCode({ code: "unsafe detail" }), "UNKNOWN");
  assert.equal(databaseErrorCode({ errorCode: "unsafe detail" }), "UNKNOWN");
  assert.equal(databaseErrorCode(new Error("connection string with secret")), "UNKNOWN");
});
