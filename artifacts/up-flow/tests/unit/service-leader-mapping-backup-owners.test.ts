import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = join(__dirname, "..", "..");

function read(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

test("department mappings store backup owners in a relational table and preserve existing data", () => {
  const schema = read("prisma/schema.prisma");
  const migration = read(
    "prisma/migrations/20260721173000_service_leader_mapping_backup_owners/migration.sql",
  );

  assert.match(schema, /model ServiceLeaderMappingBackupOwner/);
  assert.match(schema, /backup_owners\s+ServiceLeaderMappingBackupOwner\[\]/);
  assert.match(schema, /@@unique\(\[mapping_id, user_id\]\)/);
  assert.match(schema, /@@index\(\[user_id\]\)/);
  assert.match(migration, /CREATE TABLE "ServiceLeaderMappingBackupOwner"/);
  assert.match(migration, /ON DELETE CASCADE ON UPDATE CASCADE/);
  assert.match(
    migration,
    /SELECT gen_random_uuid\(\)::text, "id", "backup_leader_id"/,
  );
  assert.match(migration, /ON CONFLICT \("mapping_id", "user_id"\) DO NOTHING/);
});

test("mapping API validates and atomically replaces a multi-owner backup list", () => {
  const route = read("src/app/api/service-leader-mapping/route.ts");

  assert.match(
    route,
    /backup_leader_ids:\s*z\.array\(z\.string\(\)\.trim\(\)\.min\(1\)\)\.max\(50\)/,
  );
  assert.match(
    route,
    /mapping\.backup_leader_ids\s*\?\?\s*\(mapping\.backup_leader_id\s*\?\s*\[mapping\.backup_leader_id\]\s*:\s*\[\]\)/,
  );
  assert.match(route, /duplicate backup owners are not allowed/);
  assert.match(route, /primary responsible cannot also be a backup owner/);
  assert.match(route, /serviceLeaderMappingBackupOwner\.deleteMany/);
  assert.match(route, /serviceLeaderMappingBackupOwner\.createMany/);
  assert.match(route, /uses_legacy_backup_leader: mapping\.backup_leader_ids === undefined/);
  assert.match(route, /preserveLegacyBackupOwners/);
  assert.match(
    route,
    /const backup_leader_id = backupLeaderIds\[0\] \?\? null/,
  );
  assert.match(route, /backup_owners:\s*\{/);
});

test("department mapping panel exposes an accessible multi-owner picker", () => {
  const panel = read("src/components/team/service-leader-mapping-panel.tsx");
  const picker = read("src/components/team/backup-owners-picker.tsx");

  assert.match(panel, /<BackupOwnersPicker/);
  assert.match(picker, /data-testid="backup-owners-picker"/);
  assert.match(
    picker,
    /<CommandInput\s+placeholder=\{t\("onboardingWorkflow\.searchBackupOwners"\)\}\s*\/>/,
  );
  assert.match(panel, /backup_leader_ids: backupOwnerIdsForMapping\(mapping\)/);
  assert.match(
    panel,
    /user\.workspace_status === "active"\s*&&\s*user\.workspace_role !== "guest"/,
  );
  assert.match(panel, /user\.id !== mapping\.leader_id/);
  assert.match(panel, /onChange=\{\(backupLeaderIds\) => \{/);
});

test("all backup owners stay connected to the existing support and cleanup flows", () => {
  const socialNotifications = read("src/lib/social-media-notifications.ts");
  const userDeletion = read("src/lib/user-deletion.ts");

  assert.match(
    socialNotifications,
    /backup_owners:\s*\{\s*select:\s*\{\s*user_id:\s*true\s*\}\s*\}/,
  );
  assert.match(
    socialNotifications,
    /leader\.backup_owners\.map\(\(owner\)\s*=>\s*owner\.user_id\)/,
  );
  assert.match(
    userDeletion,
    /serviceLeaderMappingBackupOwner\.deleteMany\(\s*\{\s*where:\s*\{\s*user_id:\s*userId\s*\}\s*,?\s*\}\s*\)/,
  );
});
