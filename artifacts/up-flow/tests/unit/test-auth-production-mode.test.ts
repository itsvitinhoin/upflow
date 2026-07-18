import assert from "node:assert/strict";
import test from "node:test";
import { isTestLoginEnabled } from "../../src/lib/test-auth";

const keys = [
  "NODE_ENV",
  "TEST_LOGIN_TOKEN",
  "E2E_TEST_AUTH_BYPASS",
  "CI",
  "GITHUB_ACTIONS",
  "VERCEL",
] as const;

function restore(values: Record<string, string | undefined>) {
  for (const key of keys) {
    const value = values[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

test("production-mode test login is limited to explicitly marked GitHub Actions", () => {
  const original: Record<string, string | undefined> = Object.fromEntries(
    keys.map((key) => [key, process.env[key]]),
  );

  try {
    process.env.NODE_ENV = "production";
    process.env.TEST_LOGIN_TOKEN = "unit-test-token";
    process.env.E2E_TEST_AUTH_BYPASS = "1";
    process.env.CI = "true";
    process.env.GITHUB_ACTIONS = "true";
    delete process.env.VERCEL;
    assert.equal(isTestLoginEnabled(), true);

    process.env.VERCEL = "1";
    assert.equal(isTestLoginEnabled(), false);

    delete process.env.VERCEL;
    process.env.GITHUB_ACTIONS = "false";
    assert.equal(isTestLoginEnabled(), false);

    process.env.NODE_ENV = "development";
    delete process.env.E2E_TEST_AUTH_BYPASS;
    assert.equal(isTestLoginEnabled(), true);
  } finally {
    restore(original);
  }
});
