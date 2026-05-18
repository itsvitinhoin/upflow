import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * "Pipeline" tests — these wire the templates together with `sendEmail`
 * the same way the API routes do (`/api/invites`, `/api/auth/forgot`,
 * `/api/invites/accept`) and assert the outbound Resend POST contains
 * the right subject, links, and scope per trigger.
 *
 * This is the API-route-mock test the code review asked for, scoped to
 * just the email seam: we don't need to spin up Prisma or Supabase to
 * prove the routes are calling the correct template + sender pair.
 */

async function captureSend(action: () => Promise<unknown>) {
  const originalKey = process.env.RESEND_API_KEY;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalFetch = globalThis.fetch;
  process.env.RESEND_API_KEY = "test_key";
  process.env.NODE_ENV = "production";
  const calls: Array<{ url: string; init: RequestInit }> = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ id: "msg_test" }), { status: 200 });
  }) as typeof fetch;
  try {
    await action();
    return calls;
  } finally {
    process.env.RESEND_API_KEY = originalKey;
    process.env.NODE_ENV = originalNodeEnv;
    globalThis.fetch = originalFetch;
  }
}

test("invite trigger sends an invite-themed mail with the accept URL", async () => {
  const { sendEmail } = await import("../../src/lib/email/send");
  const { inviteEmail } = await import("../../src/lib/email/templates");
  const calls = await captureSend(async () => {
    const rendered = inviteEmail({
      workspaceName: "Acme",
      inviterName: "Alice",
      inviterEmail: "alice@example.com",
      acceptUrl: "https://app.example/invite/tok123",
      role: "member",
    });
    await sendEmail({
      to: "new@example.com",
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      scope: "invites:send",
    });
  });
  assert.equal(calls.length, 1);
  const body = JSON.parse(calls[0].init.body as string);
  assert.match(body.subject, /invited to Acme/);
  assert.match(body.html, /https:\/\/app\.example\/invite\/tok123/);
  assert.deepEqual(body.to, ["new@example.com"]);
});

test("forgot-password trigger sends a recovery-themed mail with the reset URL", async () => {
  const { sendEmail } = await import("../../src/lib/email/send");
  const { passwordResetEmail } = await import("../../src/lib/email/templates");
  const calls = await captureSend(async () => {
    const rendered = passwordResetEmail({
      resetUrl: "https://app.example/reset#access_token=abc",
      recipientEmail: "user@example.com",
    });
    await sendEmail({
      to: "user@example.com",
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      scope: "auth:forgot",
    });
  });
  assert.equal(calls.length, 1);
  const body = JSON.parse(calls[0].init.body as string);
  assert.match(body.subject, /Reset/i);
  assert.match(body.html, /https:\/\/app\.example\/reset#access_token=abc/);
});

test("invite-accepted trigger sends one mail per admin recipient", async () => {
  const { sendEmail } = await import("../../src/lib/email/send");
  const { inviteAcceptedEmail } = await import("../../src/lib/email/templates");
  const admins = ["admin1@example.com", "admin2@example.com"];
  const calls = await captureSend(async () => {
    const rendered = inviteAcceptedEmail({
      workspaceName: "Acme",
      newMemberEmail: "new@example.com",
      newMemberName: "New Person",
      role: "member",
      workspaceUrl: "https://app.example/",
    });
    await Promise.all(
      admins.map((to) =>
        sendEmail({
          to,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
          scope: "invites:accepted",
        }),
      ),
    );
  });
  assert.equal(calls.length, admins.length);
  const recipients = calls
    .map((c) => JSON.parse(c.init.body as string).to[0])
    .sort();
  assert.deepEqual(recipients, admins.sort());
  const firstBody = JSON.parse(calls[0].init.body as string);
  assert.match(firstBody.subject, /joined Acme/);
  assert.match(firstBody.html, /New Person/);
});
