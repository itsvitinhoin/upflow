import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Source-level guardrail tests for the new department endpoints —
// catches regressions where someone refactors the routes and accidentally
// drops an auth or workspace-scope check. Behavioral coverage (real
// status codes, real Prisma, real auth) lives in
// `tests/ui/departments.spec.ts` which hits the running dev server.

const ROOT = join(__dirname, "..", "..", "src", "app", "api");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

test("GET/POST /api/workspaces/[id]/departments enforces auth + scope", () => {
  const src = read("workspaces/[id]/departments/route.ts");
  assert.match(src, /requireAuth\s*\(/, "requires auth");
  assert.match(src, /canAccessWorkspace\(\s*auth\s*,\s*workspaceId\s*\)/);
  assert.match(
    src,
    /isWorkspaceAdminFor\(\s*auth\s*,\s*workspaceId\s*\)/,
    "POST is admin-only",
  );
  assert.match(src, /status:\s*403/);
  assert.match(src, /Name is required/);
  // Duplicate name → 409 surfaced as a clean client error, not a 500.
  assert.match(src, /P2002/);
  assert.match(src, /status:\s*409/);
});

test("PATCH/DELETE /api/workspaces/[id]/departments/[depId] is admin-only and workspace-scoped", () => {
  const src = read("workspaces/[id]/departments/[depId]/route.ts");
  assert.match(src, /requireAuth\s*\(/);
  // Both methods must call the admin gate.
  const adminGates = src.match(/isWorkspaceAdminFor\(/g) ?? [];
  assert.ok(adminGates.length >= 2, "expected admin gate on PATCH and DELETE");
  assert.match(src, /const\s+\{\s*id\s*,\s*depId\s*\}\s*=\s*await\s+params/);
  // Department must belong to the workspace in the URL, not just exist.
  assert.match(src, /existing\.workspace_id\s*!==\s*id/);
  assert.match(src, /status:\s*404/);
});

test("PUT /api/workspaces/[id]/members/[memberId]/department is admin-only and validates the department", () => {
  const src = read(
    "workspaces/[id]/members/[memberId]/department/route.ts",
  );
  assert.match(src, /requireAuth\s*\(/);
  assert.match(src, /const\s+\{\s*id\s*,\s*memberId\s*\}\s*=\s*await\s+params/);
  assert.match(
    src,
    /isWorkspaceAdminFor\(\s*auth\s*,\s*id\s*\)/,
  );
  // Cross-workspace department ID must be rejected with 400, not silently
  // accepted (would otherwise let an admin point a member at a department
  // from another workspace).
  assert.match(src, /dep\.workspace_id\s*!==\s*id/);
  // Null clears the assignment ("Unassigned").
  assert.match(src, /department_id:\s*departmentId/);
});

test("users API exposes department_id scoped to the requested workspace", () => {
  const src = read("users/route.ts");
  assert.match(src, /department_id:\s*scopedMembership\?\.department_id/);
  assert.match(src, /scopedWorkspaceId\s*=\s*workspaceFilter\s*\?\?/);
});

test("team overview can safely target a member-accessible workspace", () => {
  const src = read("team/overview/route.ts");
  assert.match(src, /workspace_id/);
  assert.match(src, /canAccessWorkspace\(\s*auth\s*,\s*targetWorkspaceId\s*\)/);
  assert.match(src, /reconcileAcceptedWorkspaceInvites\(targetWorkspaceId\)/);
  assert.match(src, /Workspace not found/);
  assert.match(src, /workspace_id:\s*targetWorkspaceId/);
});
