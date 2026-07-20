import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getEmailOrigin,
  EmailOriginError,
  resolveEmailOrigin,
} from "../../src/lib/email/origin";

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
    if (orig === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = orig;
  }
});

test("getEmailOrigin in production refuses to fall back to request headers", () => {
  const origAppUrl = process.env.APP_URL;
  const originalVercelProductionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const origNodeEnv = process.env.NODE_ENV;
  delete process.env.APP_URL;
  delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
  process.env.NODE_ENV = "production";
  try {
    assert.throws(
      () => getEmailOrigin(fakeReq({ host: "attacker.example", origin: "https://attacker.example" })),
      EmailOriginError,
    );
  } finally {
    if (origAppUrl === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = origAppUrl;
    if (originalVercelProductionUrl !== undefined) {
      process.env.VERCEL_PROJECT_PRODUCTION_URL = originalVercelProductionUrl;
    } else delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    process.env.NODE_ENV = origNodeEnv;
  }
});

test("production replaces an unsafe localhost APP_URL with Vercel's canonical production URL", () => {
  const originalAppUrl = process.env.APP_URL;
  const originalVercelProductionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const originalNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  process.env.APP_URL = "http://localhost:3000";
  process.env.VERCEL_PROJECT_PRODUCTION_URL = "upflow-mocha.vercel.app";

  try {
    assert.deepEqual(resolveEmailOrigin(), {
      origin: "https://upflow-mocha.vercel.app",
      source: "vercel-production-url",
      problem: "APP_URL must use HTTPS in production.",
    });
  } finally {
    if (originalAppUrl === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = originalAppUrl;
    if (originalVercelProductionUrl === undefined) delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    else process.env.VERCEL_PROJECT_PRODUCTION_URL = originalVercelProductionUrl;
    process.env.NODE_ENV = originalNodeEnv;
  }
});

test("production rejects localhost when no safe Vercel production URL is available", () => {
  const originalAppUrl = process.env.APP_URL;
  const originalVercelProductionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const originalNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  process.env.APP_URL = "https://localhost:3000";
  delete process.env.VERCEL_PROJECT_PRODUCTION_URL;

  try {
    assert.throws(
      () => getEmailOrigin(fakeReq({ host: "attacker.example" })),
      /localhost or a loopback address/,
    );
  } finally {
    if (originalAppUrl === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = originalAppUrl;
    if (originalVercelProductionUrl === undefined) delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    else process.env.VERCEL_PROJECT_PRODUCTION_URL = originalVercelProductionUrl;
    process.env.NODE_ENV = originalNodeEnv;
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
    if (origAppUrl === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = origAppUrl;
    process.env.NODE_ENV = origNodeEnv;
  }
});
