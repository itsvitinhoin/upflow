import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const ROOT = join(__dirname, "..", "..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

test("rollout documentation covers deployment, acceptance, and recovery gates", () => {
  const deployment = read("docs/deployment-checklist.md");
  const rollout = read("docs/internal-rollout-plan.md");
  const acceptance = read("docs/final-acceptance-test.md");
  const recovery = read("docs/backup-recovery-plan.md");
  const env = read("src/lib/env.ts");

  assert.match(deployment, /DATABASE_URL/);
  assert.match(deployment, /DIRECT_URL/);
  assert.match(deployment, /CRON_SECRET/);
  assert.match(deployment, /SENTRY_DSN/);
  assert.match(deployment, /REDIS_URL/);
  assert.match(deployment, /Run migrations before redeploy/i);
  assert.match(deployment, /\/admin\/health/);
  assert.match(deployment, /Secret Rotation/);
  assert.match(env, /PRODUCTION_REQUIRED/);
  assert.match(env, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(env, /RESEND_API_KEY/);
  assert.match(env, /APP_URL/);
  assert.match(env, /CRON_SECRET/);

  assert.match(rollout, /Admin-Only Testing/);
  assert.match(rollout, /Department Pilot/);
  assert.match(rollout, /Company-Wide Rollout/);
  assert.match(rollout, /Retire Old System/);

  assert.match(acceptance, /Invite a user to the current workspace/);
  assert.match(acceptance, /User logs out/);
  assert.match(acceptance, /America\/Sao_Paulo/);
  assert.match(acceptance, /Ready for department pilot/);

  assert.match(recovery, /Supabase Backups/);
  assert.match(recovery, /Vercel Rollback/);
  assert.match(recovery, /Database Recovery/);
  assert.doesNotMatch(recovery, /password\s*=/i);
});
