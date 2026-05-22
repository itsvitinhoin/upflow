import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const route = readFileSync(
  join(__dirname, "..", "..", "src", "app", "api", "invites", "route.ts"),
  "utf8",
);
const inviteDialog = readFileSync(
  join(__dirname, "..", "..", "src", "components", "dashboard", "invite-dialog.tsx"),
  "utf8",
);
const teamPage = readFileSync(
  join(__dirname, "..", "..", "src", "app", "(dashboard)", "team", "page.tsx"),
  "utf8",
);
const emailStatusRoute = readFileSync(
  join(__dirname, "..", "..", "src", "app", "api", "email", "status", "route.ts"),
  "utf8",
);

test("invite route blocks missing email configuration before creating invites", () => {
  assert.match(route, /EmailOriginError/);
  assert.match(route, /APP_URL_MISSING/);
  assert.match(route, /EMAIL_NOT_CONFIGURED/);
  assert.match(route, /emailIsConfigured\(\)/);
  assert.doesNotMatch(route, /NODE_ENV === "production" && !emailIsConfigured/);

  const appUrlCheck = route.indexOf("APP_URL_MISSING");
  const emailConfigCheck = route.indexOf("EMAIL_NOT_CONFIGURED");
  const createInvite = route.indexOf("workspaceInvite.create");
  assert.ok(appUrlCheck > -1 && appUrlCheck < createInvite);
  assert.ok(emailConfigCheck > -1 && emailConfigCheck < createInvite);
});

test("invite route treats provider failure as failed invite delivery", () => {
  assert.match(route, /EMAIL_SEND_FAILED/);
  assert.match(route, /workspaceInvite\s*\n\s*\.delete/);
  assert.match(route, /recipientHash:\s*emailFingerprint/);
  assert.doesNotMatch(
    route,
    /mailed:\s*0,\s*invites:\s*created/,
    "route must not return a successful invite response with no mailed emails",
  );
});

test("invite UI only shows success when delivery is confirmed", () => {
  assert.match(inviteDialog, /mailed !== sent/);
  assert.match(inviteDialog, /InviteErrorCode/);
  assert.match(inviteDialog, /inviteErrorHint/);
  assert.doesNotMatch(inviteDialog, /but no emails were sent/);
  assert.doesNotMatch(teamPage, /fallbackLink/);
});

test("admin email status exposes diagnostics without secrets", () => {
  assert.match(emailStatusRoute, /isWorkspaceAdmin/);
  assert.match(emailStatusRoute, /app_url_configured/);
  assert.match(emailStatusRoute, /resend_api_key_configured/);
  assert.match(emailStatusRoute, /email_from_configured/);
  assert.match(emailStatusRoute, /using_development_sender/);
  assert.doesNotMatch(emailStatusRoute, /RESEND_API_KEY:\s*process\.env/);
  assert.match(teamPage, /EmailSetupWarning/);
  assert.match(teamPage, /\/api\/email\/status/);
});
