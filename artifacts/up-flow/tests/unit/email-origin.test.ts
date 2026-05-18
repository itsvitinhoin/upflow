import { test } from "node:test";
import assert from "node:assert/strict";
import { getEmailOrigin, EmailOriginError } from "../../src/lib/email/origin";

/**
 * Mint a NextRequest-like object good enough for the helper. We only
 * touch `.headers.get(...)`, so a tiny shim avoids dragging in the full
 * Next runtime.
 */
function fakeReq(headers: Record<string, string>): any {
  return {
    headers: {
      get(name: string) {
        return headers[name.toLowerCase()] ?? null;
      },
    },
  };
}

test("getEmailOrigin prefers APP_URL and strips trailing slash", () => {
  const orig = process.env.APP_URL;
  process.env.APP_URL = "https://flow.example.com/";
  try {
    assert.equal(
      getEmailOrigin(fakeReq({ host: "attacker.example", origin: "https://attacker.example" })),
      "https://flow.example.com",
    );
  } finally {
    process.env.APP_URL = orig;
  }
});

test("getEmailOrigin in production refuses to fall back to request headers", () => {
  const origAppUrl = process.env.APP_URL;
  const origNodeEnv = process.env.NODE_ENV;
  delete process.env.APP_URL;
  process.env.NODE_ENV = "production";
  try {
    assert.throws(
      () => getEmailOrigin(fakeReq({ host: "attacker.example", origin: "https://attacker.example" })),
      EmailOriginError,
    );
  } finally {
    if (origAppUrl !== undefined) process.env.APP_URL = origAppUrl;
    process.env.NODE_ENV = origNodeEnv;
  }
});

test("getEmailOrigin in development falls back to request origin", () => {
  const origAppUrl = process.env.APP_URL;
  const origNodeEnv = process.env.NODE_ENV;
  delete process.env.APP_URL;
  process.env.NODE_ENV = "development";
  try {
    assert.equal(
      getEmailOrigin(fakeReq({ origin: "http://localhost:3000" })),
      "http://localhost:3000",
    );
    assert.equal(
      getEmailOrigin(fakeReq({ host: "localhost:3000" })),
      "http://localhost:3000",
    );
  } finally {
    if (origAppUrl !== undefined) process.env.APP_URL = origAppUrl;
    process.env.NODE_ENV = origNodeEnv;
  }
});
