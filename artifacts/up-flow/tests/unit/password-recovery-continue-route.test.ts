import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { createPasswordRecoveryState } from "../../src/lib/supabase/recovery-state";
import { POST } from "../../src/app/api/auth/forgot/continue/route";

const envNames = [
  "NODE_ENV",
  "APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "REDIS_URL",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
] as const;

const appOrigin = "https://app.example";
const redirectTo = `${appOrigin}/auth/reset`;
const supabaseUrl = "https://project.supabase.test";
const secret = "service-role-key";
const actionLink =
  `${supabaseUrl}/auth/v1/verify?` +
  new URLSearchParams({
    token: "one-time-token",
    type: "recovery",
    redirect_to: redirectTo,
  });

function snapshotEnv() {
  return Object.fromEntries(envNames.map((name) => [name, process.env[name]]));
}

function restoreEnv(snapshot: Record<string, string | undefined>) {
  for (const name of envNames) {
    const value = snapshot[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}

function configureEnv() {
  process.env.NODE_ENV = "development";
  process.env.APP_URL = appOrigin;
  process.env.NEXT_PUBLIC_SUPABASE_URL = supabaseUrl;
  process.env.SUPABASE_SERVICE_ROLE_KEY = secret;
  delete process.env.REDIS_URL;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
}

function makeRequest(state: string, ip: string) {
  const body = JSON.stringify({ state });
  return new NextRequest(`${appOrigin}/api/auth/forgot/continue`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": String(Buffer.byteLength(body)),
      "x-forwarded-for": ip,
    },
    body,
  });
}

test("resolves a valid opaque recovery state only after Continue", async () => {
  const env = snapshotEnv();
  configureEnv();
  try {
    const state = createPasswordRecoveryState({ actionLink, redirectTo, secret });
    const response = await POST(makeRequest(state, "203.0.113.111"));

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
    assert.deepEqual(await response.json(), { actionLink });
  } finally {
    restoreEnv(env);
  }
});

test("rejects an invalid or oversized recovery state without exposing an action link", async () => {
  const env = snapshotEnv();
  configureEnv();
  try {
    const invalid = await POST(makeRequest("not-a-valid-state", "203.0.113.112"));
    assert.equal(invalid.status, 400);
    const invalidBody = (await invalid.json()) as { error?: unknown };
    assert.match(String(invalidBody.error), /invalid or has expired/i);

    const oversized = await POST(makeRequest("a".repeat(9 * 1024), "203.0.113.113"));
    assert.equal(oversized.status, 400);
  } finally {
    restoreEnv(env);
  }
});
