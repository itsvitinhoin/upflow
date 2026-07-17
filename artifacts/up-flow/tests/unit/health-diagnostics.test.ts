import assert from "node:assert/strict";
import test from "node:test";
import {
  databaseErrorCode,
  databaseErrorKind,
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
  assert.equal(
    databaseErrorCode({ message: "Prisma error P1013: invalid connection string" }),
    "P1013",
  );
  assert.equal(databaseErrorCode({ cause: { errorCode: "P1002" } }), "P1002");
  assert.equal(databaseErrorCode({ code: "unsafe detail" }), "UNKNOWN");
  assert.equal(databaseErrorCode({ errorCode: "unsafe detail" }), "UNKNOWN");
  assert.equal(databaseErrorCode(new Error("connection string with secret")), "UNKNOWN");
});

test("database diagnostics classify only safe failure categories", () => {
  assert.equal(databaseErrorKind({ errorCode: "P1000" }), "authentication");
  assert.equal(databaseErrorKind({ errorCode: "P1013" }), "invalid_connection_string");
  assert.equal(
    databaseErrorKind({ message: "Can't reach database server" }),
    "unreachable",
  );
  assert.equal(
    databaseErrorKind({ name: "PrismaClientInitializationError" }),
    "prisma_initialization",
  );
  assert.equal(databaseErrorKind(new Error("unclassified failure")), "unknown");
});
