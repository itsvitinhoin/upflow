import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function read(rel: string) {
  return readFileSync(join(__dirname, "..", "..", rel), "utf8");
}

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
const teamInvitePanels = readFileSync(
  join(__dirname, "..", "..", "src", "components", "team", "team-invite-panels.tsx"),
  "utf8",
);
const teamManagementDialogs = readFileSync(
  join(
    __dirname,
    "..",
    "..",
    "src",
    "components",
    "team",
    "team-management-dialogs.tsx",
  ),
  "utf8",
);
const emailStatusRoute = readFileSync(
  join(__dirname, "..", "..", "src", "app", "api", "email", "status", "route.ts"),
  "utf8",
);
const adminHealthRoute = readFileSync(
  join(__dirname, "..", "..", "src", "app", "api", "admin", "health", "route.ts"),
  "utf8",
);
const adminHealthPage = readFileSync(
  join(__dirname, "..", "..", "src", "app", "(dashboard)", "admin", "health", "page.tsx"),
  "utf8",
);
const testerWorkspaceRoute = readFileSync(
  join(__dirname, "..", "..", "src", "app", "api", "testers", "workspace", "route.ts"),
  "utf8",
);
const acceptPage = readFileSync(
  join(__dirname, "..", "..", "src", "app", "invite", "[token]", "page.tsx"),
  "utf8",
);
const acceptRoute = readFileSync(
  join(__dirname, "..", "..", "src", "app", "api", "invites", "accept", "route.ts"),
  "utf8",
);
const inviteRegisterRoute = readFileSync(
  join(__dirname, "..", "..", "src", "app", "api", "invites", "register", "route.ts"),
  "utf8",
);
const inviteReconciliation = readFileSync(
  join(__dirname, "..", "..", "src", "lib", "invite-reconciliation.ts"),
  "utf8",
);
const workspaceLib = readFileSync(
  join(__dirname, "..", "..", "src", "lib", "workspace.ts"),
  "utf8",
);
const registerRoute = readFileSync(
  join(__dirname, "..", "..", "src", "app", "api", "users", "register", "route.ts"),
  "utf8",
);
const schema = readFileSync(
  join(__dirname, "..", "..", "prisma", "schema.prisma"),
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

test("team page makes real workspace user invites the primary flow", () => {
  assert.match(teamPage, /RealUserInvitePanel/);
  assert.match(teamInvitePanels, /Invite real users to Up Flow/);
  assert.match(teamInvitePanels, /Send official invitations/);
  assert.match(teamPage, /Send user invites/);
  assert.match(teamInvitePanels, /own UP Flow workspace/);
  assert.match(teamInvitePanels, /join \{workspace\?\.name/);
  assert.match(inviteDialog, /Own workspace/);
  assert.match(inviteDialog, /This workspace/);
  assert.match(inviteDialog, /hideRole/);
  assert.match(teamPage, /Sandbox tester tools/);
});

test("invite modes support personal workspaces and current workspace access", () => {
  assert.match(workspaceLib, /ensureOwnedWorkspace/);
  assert.doesNotMatch(workspaceLib, /where:\s*\{\s*slug:\s*"acme"\s*\}/);
  assert.match(schema, /invite_mode\s+String\s+@default\("personal_workspace"\)/);
  assert.match(route, /mode\?:\s*InviteMode/);
  assert.match(route, /const inviteMode:\s*InviteMode = testerInvite/);
  assert.match(route, /invite_mode:\s*inviteMode/);
  assert.match(route, /body\.mode === "workspace_access"/);
  assert.match(acceptRoute, /ensureOwnedWorkspace/);
  assert.match(acceptRoute, /source_workspace_id/);
  assert.match(acceptRoute, /target_workspace_id/);
  assert.match(acceptRoute, /fresh\.invite_mode === "workspace_access"/);
  assert.match(inviteRegisterRoute, /ensureOwnedWorkspace/);
  assert.match(inviteRegisterRoute, /source_workspace_id/);
  assert.match(inviteRegisterRoute, /invite\.invite_mode === "workspace_access"/);
  assert.match(inviteReconciliation, /tester_invite:\s*true/);
  assert.match(acceptPage, /your own UP Flow workspace/);
  assert.match(acceptPage, /This invite adds you to/);
  assert.match(acceptPage, /without receiving access to/);
});

test("admin health exposes actionable production diagnostics without secrets", () => {
  assert.match(adminHealthRoute, /isWorkspaceAdmin/);
  assert.match(adminHealthRoute, /Database unreachable/);
  assert.match(adminHealthRoute, /NEXT_PUBLIC_SUPABASE_URL/);
  assert.match(adminHealthRoute, /RESEND_API_KEY/);
  assert.match(adminHealthRoute, /APP_URL/);
  assert.match(adminHealthRoute, /"_prisma_migrations"/);
  assert.doesNotMatch(adminHealthRoute, /process\.env\.RESEND_API_KEY\s*,/);
  assert.match(adminHealthPage, /UP Flow admin health/);
  assert.match(adminHealthPage, /\/api\/admin\/health/);
});

test("tester invites remain available as optional sandbox tools", () => {
  assert.match(schema, /tester_invite\s+Boolean\s+@default\(false\)/);
  assert.match(schema, /send_status\s+InviteSendStatus\s+@default\(pending\)/);
  assert.match(route, /workspace_id/);
  assert.match(route, /tester_invite/);
  assert.match(testerWorkspaceRoute, /ensureTesterWorkspace/);
  assert.match(teamPage, /TesterInvitePanel/);
  assert.match(teamInvitePanels, /Tester invite workspace/);
  assert.doesNotMatch(teamPage, /lockRole/);
  assert.match(teamPage, /Choose Member for normal testers or Admin for trusted testers/);
  assert.match(teamPage, /testerMode/);
  assert.match(teamPage, /\/api\/testers\/workspace/);
  assert.match(teamPage, /loadTeamOverview\(testerWorkspace\.id\)/);
  assert.match(teamInvitePanels, /View tester members/);
  assert.match(route, /reconcileAcceptedWorkspaceInvites\(targetWorkspaceId\)/);
});

test("tester reset is super-admin only and limited to sandbox tester accounts", () => {
  const testerResetRoute = read("src/app/api/testers/reset/route.ts");

  assert.match(testerResetRoute, /isSuperAdmin/);
  assert.doesNotMatch(testerResetRoute, /isWorkspaceAdmin/);
  assert.match(testerResetRoute, /TESTER_WORKSPACE_SLUG/);
  assert.match(testerResetRoute, /tester_invite:\s*true/);
  assert.match(testerResetRoute, /Tester reset is limited to sandbox tester accounts/);
  assert.match(teamPage, /Sandbox tester tools/);
  assert.match(teamPage, /super admin only/);
  assert.match(teamInvitePanels, /Reset tester/);
});

test("tester invite acceptance explains the isolated workspace", () => {
  assert.match(acceptPage, /Tester workspace/);
  assert.match(acceptPage, /isolated UP Flow test workspace/);
  assert.match(acceptPage, /does not grant\s+access to real client workspaces/);
  assert.match(acceptPage, /login\?next=/);
});

test("manual tester accounts use Supabase auth and the isolated test workspace", () => {
  assert.match(registerRoute, /tester_account/);
  assert.match(registerRoute, /ensureTesterWorkspace/);
  assert.match(registerRoute, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(registerRoute, /auth\.admin\.createUser/);
  assert.match(teamInvitePanels, /Create tester account/);
  assert.match(teamPage, /CreateTesterAccountDialog/);
  assert.match(teamManagementDialogs, /Copy credentials/);
  assert.match(teamManagementDialogs, /\/api\/users\/register/);
  assert.match(teamManagementDialogs, /if \(loading\) return/);
});

test("team department management is isolated from the main team page", () => {
  assert.match(teamPage, /ManageDepartmentsDialog/);
  assert.match(teamManagementDialogs, /Manage departments/);
  assert.match(teamManagementDialogs, /Delete "\$\{dep\.name\}"/);
  assert.match(teamManagementDialogs, /No departments yet/);
});
