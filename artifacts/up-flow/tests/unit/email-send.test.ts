import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * Unit tests for `src/lib/email/send.ts`.
 *
 * We exercise the three modes that matter for security and observability:
 *   1. RESEND_API_KEY set      -> POSTs to api.resend.com with the rendered
 *                                  body and a Bearer header.
 *   2. No key in dev           -> Logs to stdout and returns devMode:true.
 *   3. No key in production    -> Refuses to log token-bearing bodies;
 *                                  returns ok:false.
 *
 * These tests guarantee that a missing or misconfigured email backend can
 * never leak reset/invite links into production logs.
 */

async function importFresh() {
  // Bust module cache so process.env changes are picked up per test.
  const path = require.resolve("../../src/lib/email/send");
  delete require.cache[path];
  return await import("../../src/lib/email/send");
}

test("sendEmail posts to Resend when an API key is configured", async () => {
  const originalKey = process.env.RESEND_API_KEY;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalFetch = globalThis.fetch;
  process.env.RESEND_API_KEY = "test_key_abc";
  process.env.NODE_ENV = "production";

  const calls: Array<{ url: string; init: RequestInit }> = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ id: "msg_123" }), { status: 200 });
  }) as typeof fetch;

  try {
    const { sendEmail } = await importFresh();
    const res = await sendEmail({
      to: "user@example.com",
      subject: "Reset your password",
      html: "<a>link</a>",
      text: "link",
      scope: "auth:forgot",
    });
    assert.equal(res.ok, true);
    assert.equal(res.id, "msg_123");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://api.resend.com/emails");
    const headers = calls[0].init.headers as Record<string, string>;
    assert.equal(headers.Authorization, "Bearer test_key_abc");
    const body = JSON.parse(calls[0].init.body as string);
    assert.deepEqual(body.to, ["user@example.com"]);
    assert.equal(body.subject, "Reset your password");
  } finally {
    process.env.RESEND_API_KEY = originalKey;
    process.env.NODE_ENV = originalNodeEnv;
    globalThis.fetch = originalFetch;
  }
});

test("sendEmail logs to console in development when no API key is set", async () => {
  const originalKey = process.env.RESEND_API_KEY;
  const originalNodeEnv = process.env.NODE_ENV;
  delete process.env.RESEND_API_KEY;
  process.env.NODE_ENV = "development";

  const captured: string[] = [];
  const origInfo = console.info;
  console.info = (msg: string) => captured.push(msg);

  try {
    const { sendEmail } = await importFresh();
    const res = await sendEmail({
      to: "dev@example.com",
      subject: "Welcome",
      html: "<p>hi</p>",
      text: "hi",
      scope: "test",
    });
    assert.equal(res.ok, true);
    assert.equal(res.devMode, true);
    assert.equal(captured.length, 1);
    assert.match(captured[0], /dev-mail/);
    assert.match(captured[0], /dev@example.com/);
  } finally {
    if (originalKey !== undefined) process.env.RESEND_API_KEY = originalKey;
    process.env.NODE_ENV = originalNodeEnv;
    console.info = origInfo;
  }
});

test("sendEmail refuses to log email bodies in production when key missing", async () => {
  // This is the key security guarantee added after code review: a
  // misconfigured production must NEVER spill reset tokens to logs.
  const originalKey = process.env.RESEND_API_KEY;
  const originalNodeEnv = process.env.NODE_ENV;
  delete process.env.RESEND_API_KEY;
  process.env.NODE_ENV = "production";

  const captured: string[] = [];
  const origInfo = console.info;
  console.info = (msg: string) => captured.push(msg);

  try {
    const { sendEmail } = await importFresh();
    const res = await sendEmail({
      to: "victim@example.com",
      subject: "Reset link",
      html: '<a href="https://attacker.example/recover?token=SECRET_TOKEN">click</a>',
      text: "https://attacker.example/recover?token=SECRET_TOKEN",
      scope: "auth:forgot",
    });
    assert.equal(res.ok, false);
    // No body — nor a token — must have hit console.info.
    for (const line of captured) {
      assert.doesNotMatch(line, /SECRET_TOKEN/);
      assert.doesNotMatch(line, /victim@example.com/);
    }
  } finally {
    if (originalKey !== undefined) process.env.RESEND_API_KEY = originalKey;
    process.env.NODE_ENV = originalNodeEnv;
    console.info = origInfo;
  }
});
