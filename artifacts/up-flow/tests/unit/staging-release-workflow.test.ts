import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const vercelConfig = JSON.parse(
  readFileSync(new URL("../../vercel.json", import.meta.url), "utf8"),
) as { git?: { deploymentEnabled?: boolean } };
const stagingWorkflow = readFileSync(
  new URL("../../../../.github/workflows/deploy-staging.yml", import.meta.url),
  "utf8",
);
const stagingBaselineAssertion = "db:migrate:assert-staging-baseline";

test("Vercel Git deployments are disabled in favor of controlled releases", () => {
  assert.equal(vercelConfig.git?.deploymentEnabled, false);
});

test("staging only deploys a successful Test workflow from the trusted staging branch", () => {
  assert.match(stagingWorkflow, /workflow_run:/);
  assert.match(stagingWorkflow, /workflows: \["Test"\]/);
  assert.match(stagingWorkflow, /branches: \[staging\]/);
  assert.match(stagingWorkflow, /github\.event\.workflow_run\.conclusion == 'success'/);
  assert.match(stagingWorkflow, /github\.event\.workflow_run\.event == 'push'/);
  assert.match(stagingWorkflow, /github\.event\.workflow_run\.head_branch == 'staging'/);
  assert.match(stagingWorkflow, /github\.event\.workflow_run\.head_repository\.full_name == github\.repository/);
  assert.match(stagingWorkflow, /ref: \$\{\{ github\.event\.workflow_run\.head_sha \}\}/);
  assert.match(stagingWorkflow, /cancel-in-progress: false/);
});

test("staging migration and deployment credentials are isolated and fail closed", () => {
  assert.match(stagingWorkflow, /environment: staging/);
  assert.match(stagingWorkflow, /UPFLOW_STAGING_MIGRATION_URL/);
  assert.doesNotMatch(stagingWorkflow, /UPFLOW_STAGING_PROJECT_REF/);
  assert.match(stagingWorkflow, /UPFLOW_STAGING_VERCEL_ORG_ID/);
  assert.match(stagingWorkflow, /UPFLOW_STAGING_VERCEL_PROJECT_ID/);
  assert.match(stagingWorkflow, /Require the direct staging database URL/);
  assert.match(stagingWorkflow, /Require isolated staging Vercel credentials/);
  assert.match(stagingWorkflow, /db:migrate:preflight/);
  assert.match(stagingWorkflow, new RegExp(stagingBaselineAssertion));
  assert.match(stagingWorkflow, /db:migrate:deploy/);
  assert.match(stagingWorkflow, /db:migrate:status/);
  assert.match(stagingWorkflow, /vercel@56\.2\.1 deploy --prod --yes/);
});

test("staging refuses to migrate an unbaselined schema clone", () => {
  const baselineAssertionIndex = stagingWorkflow.indexOf(stagingBaselineAssertion);
  const preflightIndex = stagingWorkflow.indexOf("db:migrate:preflight");
  const deployIndex = stagingWorkflow.indexOf("db:migrate:deploy");

  assert.ok(baselineAssertionIndex >= 0);
  assert.ok(baselineAssertionIndex < preflightIndex);
  assert.ok(preflightIndex < deployIndex);
  assert.match(stagingWorkflow, /UPFLOW_RELEASE_TARGET: staging/);
});
