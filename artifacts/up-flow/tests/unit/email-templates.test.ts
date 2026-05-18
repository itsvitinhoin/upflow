import { test } from "node:test";
import assert from "node:assert/strict";
import {
  inviteEmail,
  passwordResetEmail,
  inviteAcceptedEmail,
  escapeHtml,
} from "../../src/lib/email/templates";

/**
 * Template tests pin down the contract our routes rely on: subject,
 * link inclusion, and HTML escaping of attacker-controlled fields.
 */

test("escapeHtml neutralizes HTML special chars", () => {
  assert.equal(escapeHtml("<script>x</script>"), "&lt;script&gt;x&lt;/script&gt;");
  assert.equal(escapeHtml(`O"Reilly & 'co'`), "O&quot;Reilly &amp; &#39;co&#39;");
});

test("inviteEmail renders subject, link, and escapes hostile inviter names", () => {
  const out = inviteEmail({
    inviterName: '<img onerror=alert(1) src=x>',
    inviterEmail: "alice@example.com",
    workspaceName: "Acme & Co",
    acceptUrl: "https://app.example/invite?token=tok123",
    role: "member",
  });
  assert.match(out.subject, /Acme/);
  assert.match(out.html, /https:\/\/app\.example\/invite\?token=tok123/);
  assert.match(out.text, /https:\/\/app\.example\/invite\?token=tok123/);
  // Hostile inviter name must be escaped in HTML output.
  assert.doesNotMatch(out.html, /<img onerror/);
  assert.match(out.html, /&lt;img/);
});

test("passwordResetEmail includes the reset link and is recovery-themed", () => {
  const out = passwordResetEmail({
    resetUrl: "https://app.example/reset?token=abc",
    recipientEmail: "user@example.com",
  });
  assert.match(out.subject, /password/i);
  assert.match(out.html, /https:\/\/app\.example\/reset\?token=abc/);
  assert.match(out.text, /https:\/\/app\.example\/reset\?token=abc/);
});

test("inviteAcceptedEmail names the new member and workspace", () => {
  const out = inviteAcceptedEmail({
    workspaceName: "Acme",
    newMemberEmail: "new@example.com",
    newMemberName: "New Person",
    role: "member",
    workspaceUrl: "https://app.example/",
  });
  assert.match(out.subject, /joined/i);
  assert.match(out.html, /New Person/);
  assert.match(out.text, /new@example\.com/);
  assert.match(out.html, /https:\/\/app\.example\//);
});
