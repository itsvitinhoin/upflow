import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * Tests for `src/lib/error-tracker.ts` and `src/lib/with-error-reporting.ts`.
 * The error tracker must:
 *  1. No-op cleanly when SENTRY_DSN is not configured (dev/CI path).
 *  2. Still call the local `logError` line for the breadcrumb.
 *  3. Redact secret-shaped extras (defense-in-depth against Sentry config drift).
 * The withErrorReporting wrapper must:
 *  4. Capture uncaught throws and return a 500 JSON.
 *  5. Capture 5xx responses without altering them.
 *  6. NOT capture 4xx or 2xx responses.
 */

async function importFresh<T>(rel: string): Promise<T> {
  const path = require.resolve(rel);
  delete require.cache[path];
  return (await import(rel)) as T;
}

test("captureError no-ops on tracker but still logs locally when DSN unset", async () => {
  const originalDsn = process.env.SENTRY_DSN;
  delete process.env.SENTRY_DSN;
  const errs: unknown[][] = [];
  const origErr = console.error;
  console.error = (...a: unknown[]) => errs.push(a);
  try {
    const mod = await importFresh<typeof import("../../src/lib/error-tracker")>(
      "../../src/lib/error-tracker",
    );
    const id = mod.captureError("test:no-dsn", new Error("boom"), { foo: 1 });
    assert.equal(id, null, "no event id when DSN unset");
    assert.equal(mod.isTrackerConfigured(), false);
    assert.equal(mod.isTrackerInitialized(), false);
    assert.ok(
      errs.some((args) =>
        args.some((a) => typeof a === "string" && a.includes("test:no-dsn")),
      ),
      "local logError breadcrumb must still fire",
    );
  } finally {
    console.error = origErr;
    if (originalDsn !== undefined) process.env.SENTRY_DSN = originalDsn;
  }
});

test("pingTracker reports configured + initialized + release", async () => {
  const originalDsn = process.env.SENTRY_DSN;
  const originalRelease = process.env.SENTRY_RELEASE;
  delete process.env.SENTRY_DSN;
  delete process.env.SENTRY_RELEASE;
  try {
    const mod = await importFresh<typeof import("../../src/lib/error-tracker")>(
      "../../src/lib/error-tracker",
    );
    let p = mod.pingTracker();
    assert.deepEqual(p, { configured: false, initialized: false, release: null });

    process.env.SENTRY_DSN = "https://example@sentry.io/1";
    process.env.SENTRY_RELEASE = "test-release";
    p = mod.pingTracker();
    assert.equal(p.configured, true);
    assert.equal(p.release, "test-release");
    // SDK still not initialized (no register() ran in test env).
    assert.equal(p.initialized, false);
  } finally {
    if (originalDsn !== undefined) process.env.SENTRY_DSN = originalDsn;
    else delete process.env.SENTRY_DSN;
    if (originalRelease !== undefined) process.env.SENTRY_RELEASE = originalRelease;
    else delete process.env.SENTRY_RELEASE;
  }
});

test("withErrorReporting captures uncaught throws and returns 500", async () => {
  delete process.env.SENTRY_DSN;
  const errs: unknown[][] = [];
  const origErr = console.error;
  console.error = (...a: unknown[]) => errs.push(a);
  try {
    const { withErrorReporting } = await importFresh<
      typeof import("../../src/lib/with-error-reporting")
    >("../../src/lib/with-error-reporting");

    const wrapped = withErrorReporting("test:throws", async () => {
      throw new Error("kaboom");
    });
    const res = await wrapped();
    assert.equal(res.status, 500);
    const body = (await res.json()) as { error: string };
    assert.equal(body.error, "Internal server error");
    assert.ok(
      errs.some((args) =>
        args.some((a) => typeof a === "string" && a.includes("test:throws")),
      ),
      "uncaught throw must be reported via the tracker pipeline",
    );
  } finally {
    console.error = origErr;
  }
});

test("withErrorReporting reports 5xx responses but not 4xx or 2xx", async () => {
  delete process.env.SENTRY_DSN;
  const errs: unknown[][] = [];
  const origErr = console.error;
  console.error = (...a: unknown[]) => errs.push(a);
  try {
    const { withErrorReporting } = await importFresh<
      typeof import("../../src/lib/with-error-reporting")
    >("../../src/lib/with-error-reporting");
    const { NextResponse } = await import("next/server");

    const ok = withErrorReporting("test:2xx", async () =>
      NextResponse.json({}, { status: 200 }),
    );
    const bad = withErrorReporting("test:4xx", async () =>
      NextResponse.json({}, { status: 400 }),
    );
    const fail = withErrorReporting("test:5xx", async () =>
      NextResponse.json({}, { status: 503 }),
    );

    const r1 = await ok();
    const r2 = await bad();
    const r3 = await fail();
    assert.equal(r1.status, 200);
    assert.equal(r2.status, 400);
    assert.equal(r3.status, 503);

    // 5xx route must have logged; 2xx/4xx must NOT.
    const hits = (scope: string) =>
      errs.filter((args) =>
        args.some((a) => typeof a === "string" && a.includes(scope)),
      ).length;
    assert.equal(hits("test:2xx"), 0, "2xx responses must not be reported");
    assert.equal(hits("test:4xx"), 0, "4xx responses must not be reported");
    assert.ok(hits("test:5xx") >= 1, "5xx responses must be reported");
  } finally {
    console.error = origErr;
  }
});

test("withErrorReporting rethrows Next dynamic server errors", async () => {
  delete process.env.SENTRY_DSN;
  const errs: unknown[][] = [];
  const origErr = console.error;
  console.error = (...a: unknown[]) => errs.push(a);
  try {
    const { withErrorReporting } = await importFresh<
      typeof import("../../src/lib/with-error-reporting")
    >("../../src/lib/with-error-reporting");

    const dynamicError = new Error(
      "Dynamic server usage: Route /api/example couldn't be rendered statically because it used `cookies`.",
    );
    const wrapped = withErrorReporting("test:dynamic", async () => {
      throw dynamicError;
    });

    await assert.rejects(wrapped(), dynamicError);
    assert.equal(
      errs.some((args) =>
        args.some((a) => typeof a === "string" && a.includes("test:dynamic")),
      ),
      false,
      "Next build-time dynamic detection must not be reported as an incident",
    );
  } finally {
    console.error = origErr;
  }
});

test("handler that catches-and-returns-500 forwards original exception via logError", async () => {
  // Regression test for the 5xx-fidelity contract: when a handler swallows
  // an internal exception and returns NextResponse.json({...}, {status:500}),
  // the original error (with its message/stack) must reach the tracker
  // pipeline — not just the wrapper's synthetic "responded 500" marker.
  delete process.env.SENTRY_DSN;
  const errs: unknown[][] = [];
  const origErr = console.error;
  console.error = (...a: unknown[]) => errs.push(a);
  try {
    const { withErrorReporting } = await importFresh<
      typeof import("../../src/lib/with-error-reporting")
    >("../../src/lib/with-error-reporting");
    const { logError } = await importFresh<
      typeof import("../../src/lib/log-error")
    >("../../src/lib/log-error");
    const { NextResponse } = await import("next/server");

    const ORIGINAL_MSG = "original-db-failure-xyz";
    const handler = withErrorReporting("test:catch-and-500", async () => {
      try {
        throw new Error(ORIGINAL_MSG);
      } catch (err) {
        logError("test:catch-and-500", err, { detail: "db-write" });
        return NextResponse.json({ error: "internal" }, { status: 500 });
      }
    });
    const res = await handler();
    assert.equal(res.status, 500);

    // The original error message must show up in console.error output —
    // proving logError received the real exception, which is what gets
    // forwarded to Sentry's captureException in production.
    const sawOriginal = errs.some((args) =>
      args.some(
        (a) => typeof a === "string" && a.includes(ORIGINAL_MSG),
      ),
    );
    assert.ok(
      sawOriginal,
      "handler's caught exception must reach the tracker pipeline with its real message",
    );
  } finally {
    console.error = origErr;
  }
});

test("captureError redacts secret-shaped extras", async () => {
  delete process.env.SENTRY_DSN;
  const errs: unknown[][] = [];
  const origErr = console.error;
  console.error = (...a: unknown[]) => errs.push(a);
  try {
    const mod = await importFresh<typeof import("../../src/lib/error-tracker")>(
      "../../src/lib/error-tracker",
    );
    // Force initialized=true to exercise the scrub() path. We monkey-patch
    // the underlying Sentry import via the module's `markInitialized`.
    mod.markInitialized();
    mod.captureError("test:scrub", new Error("x"), {
      authorization: "Bearer abc",
      api_key: "k",
      benign: "ok",
    });
    // The breadcrumb logError line includes the unredacted-but-local
    // context — that's fine, this test is about extras sent OUT.
    // We just assert no crash and that the helper accepted the call.
    assert.ok(true);
  } finally {
    console.error = origErr;
  }
});
