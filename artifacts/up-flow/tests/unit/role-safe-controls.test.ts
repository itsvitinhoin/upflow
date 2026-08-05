import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { hasWorkspaceAdminAccess } from "../../src/lib/client-role-access";

const ROOT = join(__dirname, "..", "..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

test("workspace-admin UI capability matches the server-facing roles", () => {
  assert.equal(hasWorkspaceAdminAccess({ currentRole: "owner" }), true);
  assert.equal(hasWorkspaceAdminAccess({ currentRole: "admin" }), true);
  assert.equal(hasWorkspaceAdminAccess({ currentRole: "member" }), false);
  assert.equal(hasWorkspaceAdminAccess({ currentRole: "guest" }), false);
  assert.equal(hasWorkspaceAdminAccess({ currentRole: "guest", isSuperAdmin: true }), true);
});

test("restricted users are shown an explanation instead of rejected client and upload controls", () => {
  const clientsPage = read("src/app/(dashboard)/clients/page.tsx");
  const clientDetailPage = read("src/app/(dashboard)/clients/[id]/page.tsx");
  const taskCoverControl = read("src/components/projects/task-cover-image-control.tsx");
  const timePage = read("src/app/(dashboard)/time/page.tsx");

  assert.match(clientsPage, /hasWorkspaceAdminAccess\(user\)/);
  assert.match(clientsPage, /data-testid="client-read-only"/);
  assert.match(clientsPage, /clients\.manageRestrictedHint/);
  assert.match(clientsPage, /isWorkspaceAdmin \? \(/);
  assert.match(clientDetailPage, /hasWorkspaceAdminAccess\(user\)/);
  assert.match(clientDetailPage, /data-testid="client-detail-read-only"/);
  assert.match(clientDetailPage, /clientDetail\.manageRestricted/);
  assert.match(clientDetailPage, /canManageClient && editingManager/);
  assert.match(clientDetailPage, /canManageClient && editingPlan/);
  assert.match(clientDetailPage, /canManageClient && editingContact\?\.id/);
  assert.match(clientDetailPage, /canManageClient && editingNote\?\.id/);
  assert.match(clientDetailPage, /canManageClient \? \(\s*<NewProjectDialog/s);
  assert.doesNotMatch(taskCoverControl, /hasWorkspaceAdminAccess\(user\)/);
  assert.match(taskCoverControl, /canUploadTaskCover \? \(/);
  assert.match(taskCoverControl, /data-testid="task-cover-upload-requires-project"/);
  assert.match(taskCoverControl, /taskCover\.projectRequired/);
  assert.match(timePage, /hasWorkspaceAdminAccess\(user\)/);
  assert.match(timePage, /canManageTime \? \(/);
  assert.match(timePage, /data-testid="time-tracking-read-only"/);
  assert.match(timePage, /time\.manageRestricted/);
});
