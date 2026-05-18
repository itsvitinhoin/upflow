import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

/**
 * API-level integration test: loop POSTs against the real `/api/auth/login`
 * route handler and assert it trips 429 at the documented threshold (10/min)
 * with a `Retry-After` header.
 *
 * We deliberately POST an empty body so the rate-limit check (which runs
 * BEFORE Supabase) returns first; the request never touches Supabase.
 * Successful checks fall through to the missing-credentials 400.
 */

function makeReq(): NextRequest {
  return new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "x-forwarded-for": "203.0.113.42" },
    body: JSON.stringify({}),
  });
}

test("login route trips 429 at the configured threshold with Retry-After", async () => {
  // Force the in-process limiter so the test doesn't reach Upstash.
  const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
  const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;

  // Re-import so the module re-reads env on first use.
  const rlPath = require.resolve("../../src/lib/rate-limit");
  delete require.cache[rlPath];
  const routePath = require.resolve("../../src/app/api/auth/login/route");
  delete require.cache[routePath];

  try {
    const { POST } = await import("../../src/app/api/auth/login/route");

    let firstLimited = -1;
    let lastBelow = -1;
    // 10 allowed per minute on the login bucket. The 11th call must trip.
    for (let i = 0; i < 12; i++) {
      const res = await POST(makeReq());
      if (res.status === 429 && firstLimited === -1) {
        firstLimited = i;
        assert.ok(
          Number(res.headers.get("Retry-After")) >= 1,
          "Retry-After must be set to a positive integer",
        );
        const body = await res.json();
        assert.match(String(body.error), /too many/i);
      } else if (res.status !== 429) {
        lastBelow = i;
      }
    }

    assert.equal(firstLimited, 10, "11th call (index 10) should be the first 429");
    assert.equal(lastBelow, 9, "calls 0..9 should not be 429");
  } finally {
    if (originalUrl !== undefined) process.env.UPSTASH_REDIS_REST_URL = originalUrl;
    if (originalToken !== undefined)
      process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
  }
});
