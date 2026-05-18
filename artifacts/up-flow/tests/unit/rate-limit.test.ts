import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * Tests for `src/lib/rate-limit.ts`.
 *
 * We cover the three behaviors that matter for production protection:
 *   1. No store configured -> falls back to the in-process limiter and
 *      blocks at the documented threshold (with a degraded-protection log).
 *   2. Upstash configured and reachable -> uses the REST API and trips
 *      at the right count using the count returned by INCR.
 *   3. Upstash configured but unreachable -> fails OPEN (still serves)
 *      and logs the outage; never silently fails closed.
 */

async function importFresh() {
  const path = require.resolve("../../src/lib/rate-limit");
  delete require.cache[path];
  return await import("../../src/lib/rate-limit");
}

function mockReq(ip = "1.2.3.4"): import("next/server").NextRequest {
  return {
    headers: new Headers({ "x-forwarded-for": ip }),
    ip: undefined,
  } as unknown as import("next/server").NextRequest;
}

test("falls back to in-process limiter when Upstash env is unset", async () => {
  const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
  const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;

  try {
    const { checkRateLimit } = await importFresh();
    const req = mockReq("10.0.0.1");
    const opts = { windowMs: 60_000, max: 3, key: "test-unset" };
    const a = await checkRateLimit(req, opts);
    const b = await checkRateLimit(req, opts);
    const c = await checkRateLimit(req, opts);
    const d = await checkRateLimit(req, opts);
    assert.equal(a.ok, true);
    assert.equal(a.backend, "memory");
    assert.equal(b.ok, true);
    assert.equal(c.ok, true);
    assert.equal(d.ok, false, "4th call should trip the limit");
    assert.ok(d.retryAfter >= 1);
  } finally {
    if (originalUrl !== undefined) process.env.UPSTASH_REDIS_REST_URL = originalUrl;
    if (originalToken !== undefined) process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
  }
});

test("uses Upstash REST when configured and trips at the documented threshold", async () => {
  const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
  const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const originalFetch = globalThis.fetch;
  process.env.UPSTASH_REDIS_REST_URL = "https://example-upstash.test";
  process.env.UPSTASH_REDIS_REST_TOKEN = "token_abc";

  let counter = 0;
  const calls: Array<{ url: string; init: RequestInit }> = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const body = JSON.parse(init.body as string) as unknown[][];
    // Pipeline returns one entry per command; first is INCR's count.
    const results = body.map((cmd) => {
      if (cmd[0] === "INCR") return { result: ++counter };
      if (cmd[0] === "EXPIRE") return { result: 1 };
      return { result: null };
    });
    return new Response(JSON.stringify(results), { status: 200 });
  }) as typeof fetch;

  try {
    const { checkRateLimit } = await importFresh();
    const opts = { windowMs: 60_000, max: 2, key: "test-redis" };
    const a = await checkRateLimit(mockReq("9.9.9.9"), opts);
    const b = await checkRateLimit(mockReq("9.9.9.9"), opts);
    const c = await checkRateLimit(mockReq("9.9.9.9"), opts);
    assert.equal(a.ok, true);
    assert.equal(a.backend, "redis");
    assert.equal(b.ok, true);
    assert.equal(c.ok, false, "3rd call should trip");
    assert.equal(c.backend, "redis");
    assert.ok(c.retryAfter >= 1);

    // Ensure we hit Upstash's /pipeline endpoint with INCR + EXPIRE NX.
    const lastBody = JSON.parse(calls.at(-1)!.init.body as string);
    assert.equal(lastBody[0][0], "INCR");
    assert.equal(lastBody[1][0], "EXPIRE");
    assert.equal(lastBody[1][3], "NX");
    assert.ok(calls.at(-1)!.url.endsWith("/pipeline"));
    assert.equal(
      (calls.at(-1)!.init.headers as Record<string, string>).Authorization,
      "Bearer token_abc",
    );
  } finally {
    if (originalUrl !== undefined) process.env.UPSTASH_REDIS_REST_URL = originalUrl;
    else delete process.env.UPSTASH_REDIS_REST_URL;
    if (originalToken !== undefined) process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
    else delete process.env.UPSTASH_REDIS_REST_TOKEN;
    globalThis.fetch = originalFetch;
  }
});

test("fails OPEN when Upstash is configured but unreachable — never 429s", async () => {
  const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
  const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const originalFetch = globalThis.fetch;
  const originalErr = console.error;
  process.env.UPSTASH_REDIS_REST_URL = "https://example-upstash.test";
  process.env.UPSTASH_REDIS_REST_TOKEN = "token_abc";

  let fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    throw new Error("network down");
  }) as typeof fetch;

  const errs: unknown[][] = [];
  console.error = (...args: unknown[]) => errs.push(args);

  try {
    const { checkRateLimit } = await importFresh();
    // max:2 — without true fail-open behavior, a per-instance memory
    // limiter would 429 on the 3rd call. We assert that 50 consecutive
    // calls during the outage all succeed.
    const opts = { windowMs: 60_000, max: 2, key: "test-down" };
    for (let i = 0; i < 50; i++) {
      const r = await checkRateLimit(mockReq("7.7.7.7"), opts);
      assert.equal(r.ok, true, `call #${i} must fail-open (got 429)`);
      assert.equal(r.retryAfter, 0);
    }
    assert.equal(fetchCalls, 50, "should attempt Upstash on every call");
    assert.ok(
      errs.some((args) =>
        args.some(
          (a) => typeof a === "string" && a.includes("rate-limit:redis-unavailable"),
        ),
      ),
      "should log the redis outage so on-call notices",
    );
  } finally {
    if (originalUrl !== undefined) process.env.UPSTASH_REDIS_REST_URL = originalUrl;
    else delete process.env.UPSTASH_REDIS_REST_URL;
    if (originalToken !== undefined) process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
    else delete process.env.UPSTASH_REDIS_REST_TOKEN;
    globalThis.fetch = originalFetch;
    console.error = originalErr;
  }
});

test("rateLimitResponse sets Retry-After and 429", async () => {
  const { rateLimitResponse } = await importFresh();
  const res = rateLimitResponse({
    ok: false,
    remaining: 0,
    retryAfter: 42,
    backend: "redis",
  });
  assert.equal(res.status, 429);
  assert.equal(res.headers.get("Retry-After"), "42");
});

test("pingRateLimiter reports memory backend when no store configured", async () => {
  const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
  const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  try {
    const { pingRateLimiter } = await importFresh();
    const r = await pingRateLimiter();
    assert.equal(r.configured, false);
    assert.equal(r.backend, "memory");
    assert.equal(r.ok, true);
  } finally {
    if (originalUrl !== undefined) process.env.UPSTASH_REDIS_REST_URL = originalUrl;
    if (originalToken !== undefined) process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
  }
});

test("pingRateLimiter reports error when Upstash configured but PING fails", async () => {
  const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
  const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const originalFetch = globalThis.fetch;
  process.env.UPSTASH_REDIS_REST_URL = "https://example-upstash.test";
  process.env.UPSTASH_REDIS_REST_TOKEN = "token_abc";
  globalThis.fetch = (async () => {
    throw new Error("dns failure");
  }) as typeof fetch;
  try {
    const { pingRateLimiter } = await importFresh();
    const r = await pingRateLimiter();
    assert.equal(r.configured, true);
    assert.equal(r.ok, false);
    assert.equal(r.backend, "memory");
    assert.match(r.error ?? "", /dns failure/);
  } finally {
    if (originalUrl !== undefined) process.env.UPSTASH_REDIS_REST_URL = originalUrl;
    else delete process.env.UPSTASH_REDIS_REST_URL;
    if (originalToken !== undefined) process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
    else delete process.env.UPSTASH_REDIS_REST_TOKEN;
    globalThis.fetch = originalFetch;
  }
});
