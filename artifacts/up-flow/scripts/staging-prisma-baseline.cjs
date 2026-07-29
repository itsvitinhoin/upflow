const { createHash } = require("node:crypto");
const { existsSync, readdirSync, readFileSync } = require("node:fs");
const { dirname, join, resolve } = require("node:path");
const { spawnSync } = require("node:child_process");

const APP_ROOT = resolve(__dirname, "..");
const PRISMA_ROOT = join(APP_ROOT, "prisma");
const MIGRATIONS_DIRECTORY = join(PRISMA_ROOT, "migrations");
const SCHEMA_PATH = join(PRISMA_ROOT, "schema.prisma");
const MANIFEST_PATH = join(PRISMA_ROOT, "staging-clone-baseline.json");
const BASELINE_CONFIRMATION = "BASELINE-STAGING-PRISMA-HISTORY";
const STAGING_REF = "refs/heads/staging";
const FROZEN_SCHEMA_PATH_ENV = "STAGING_PRISMA_BASELINE_SCHEMA_PATH";
const FROZEN_MIGRATIONS_DIRECTORY_ENV = "STAGING_PRISMA_BASELINE_MIGRATIONS_DIRECTORY";
const prismaCommand = process.platform === "win32" ? "prisma.cmd" : "prisma";

function fail(message) {
  throw new Error(message);
}

function sha256(filePath) {
  // GitHub Actions checks out LF files while Windows worktrees commonly use
  // CRLF. Migrations are UTF-8 SQL, so hash their canonical LF form.
  const normalizedSql = readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");
  return createHash("sha256").update(normalizedSql, "utf8").digest("hex");
}

function sorted(values) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function sameValues(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function readBaselineManifest(manifestPath = MANIFEST_PATH) {
  let manifest;

  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (error) {
    fail(`Could not read the staging baseline manifest: ${error.message}`);
  }

  if (manifest?.version !== 1 || !Array.isArray(manifest.migrations) || manifest.migrations.length === 0) {
    fail("The staging baseline manifest is malformed or empty.");
  }

  if (
    typeof manifest.staging_project_ref !== "string" ||
    !/^[a-z0-9]+$/i.test(manifest.staging_project_ref) ||
    typeof manifest.production_project_ref !== "string" ||
    !/^[a-z0-9]+$/i.test(manifest.production_project_ref) ||
    manifest.staging_project_ref === manifest.production_project_ref
  ) {
    fail("The staging baseline manifest must pin distinct reviewed staging and production project references.");
  }

  if (typeof manifest.source_commit !== "string" || !/^[a-f0-9]{7,40}$/i.test(manifest.source_commit)) {
    fail("The staging baseline manifest must record the reviewed source commit.");
  }

  const names = manifest.migrations.map((migration) => migration?.name);
  const checksums = manifest.migrations.map((migration) => migration?.sha256);

  if (
    names.some((name) => typeof name !== "string" || !/^\d{14}_[a-z0-9_]+$/.test(name)) ||
    new Set(names).size !== names.length ||
    !sameValues(names, sorted(names))
  ) {
    fail("The staging baseline manifest must contain unique migration names in lexical order.");
  }

  if (checksums.some((checksum) => typeof checksum !== "string" || !/^[a-f0-9]{64}$/.test(checksum))) {
    fail("The staging baseline manifest contains an invalid migration checksum.");
  }

  if (
    !Array.isArray(manifest.required_extensions) ||
    manifest.required_extensions.some((extension) => typeof extension !== "string" || !/^[a-z0-9_]+$/.test(extension))
  ) {
    fail("The staging baseline manifest contains an invalid required extension list.");
  }

  return manifest;
}

function getLocalMigrations(migrationsDirectory = MIGRATIONS_DIRECTORY) {
  return readdirSync(migrationsDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const migrationPath = join(migrationsDirectory, entry.name, "migration.sql");
      if (!existsSync(migrationPath)) {
        fail(`Migration ${entry.name} is missing migration.sql.`);
      }

      return { name: entry.name, sha256: sha256(migrationPath) };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

function getFrozenBaselineSourcePaths(env = process.env) {
  const rawSchemaPath = env[FROZEN_SCHEMA_PATH_ENV];
  const rawMigrationsDirectory = env[FROZEN_MIGRATIONS_DIRECTORY_ENV];

  if (!rawSchemaPath || !rawMigrationsDirectory) {
    fail(
      `The one-time staging baseline requires both ${FROZEN_SCHEMA_PATH_ENV} and ${FROZEN_MIGRATIONS_DIRECTORY_ENV}. ` +
        "Use the frozen source checkout from the reviewed baseline workflow.",
    );
  }

  const schemaPath = resolve(rawSchemaPath);
  const migrationsDirectory = resolve(rawMigrationsDirectory);
  if (!existsSync(schemaPath) || !existsSync(migrationsDirectory)) {
    fail("The frozen staging baseline source checkout is missing its Prisma schema or migrations directory.");
  }

  if (migrationsDirectory !== join(dirname(schemaPath), "migrations")) {
    fail("The frozen staging baseline migrations directory must be adjacent to its frozen schema.prisma file.");
  }

  return { schemaPath, migrationsDirectory };
}

function assertManifestMatchesCurrentMigrations(manifest, localMigrations, { exact } = { exact: true }) {
  const localByName = new Map(localMigrations.map((migration) => [migration.name, migration]));

  for (const expectedMigration of manifest.migrations) {
    const actualMigration = localByName.get(expectedMigration.name);
    if (!actualMigration) {
      fail(`The frozen staging baseline migration ${expectedMigration.name} is missing from this checkout.`);
    }
    if (actualMigration.sha256 !== expectedMigration.sha256) {
      fail(`The frozen staging baseline migration ${expectedMigration.name} has changed. Review and replace the baseline manifest deliberately.`);
    }
  }

  if (exact) {
    const expectedNames = manifest.migrations.map((migration) => migration.name);
    const localNames = localMigrations.map((migration) => migration.name);
    if (!sameValues(expectedNames, localNames)) {
      fail(
        "The current migration tree differs from the frozen staging baseline. Do not baseline a newer or altered tree; review it and create a new baseline manifest first.",
      );
    }
  }
}

function getExpectedAppTableNames(schemaPath = SCHEMA_PATH) {
  const schema = readFileSync(schemaPath, "utf8");
  if (/@@map\s*\(/.test(schema)) {
    fail("The staging baseline table check needs an explicit table mapping because schema.prisma now uses @@map.");
  }

  const tableNames = [...schema.matchAll(/^model\s+(\w+)\s+\{/gm)].map((match) => match[1]);
  if (tableNames.length === 0 || new Set(tableNames).size !== tableNames.length) {
    fail("Could not determine the expected Prisma model tables from schema.prisma.");
  }

  return sorted(tableNames);
}

function parseStagingDatabaseUrl(rawUrl, environmentName, stagingProjectRef) {
  if (!rawUrl) {
    fail(`${environmentName} is required for the staging database check.`);
  }

  let databaseUrl;
  try {
    databaseUrl = new URL(rawUrl);
  } catch {
    fail(`${environmentName} must be a valid PostgreSQL connection URL.`);
  }

  if (databaseUrl.protocol !== "postgresql:" && databaseUrl.protocol !== "postgres:") {
    fail(`${environmentName} must use the PostgreSQL protocol.`);
  }

  const expectedDirectHost = `db.${stagingProjectRef}.supabase.co`;
  const isDirectConnection =
    databaseUrl.hostname.toLowerCase() === expectedDirectHost &&
    databaseUrl.port === "5432" &&
    databaseUrl.username === "postgres";
  const isSupavisorSessionConnection =
    /^aws-[a-z0-9-]+\.pooler\.supabase\.com$/i.test(databaseUrl.hostname) &&
    databaseUrl.port === "5432" &&
    databaseUrl.username === `postgres.${stagingProjectRef}`;

  if (!isDirectConnection && !isSupavisorSessionConnection) {
    fail(
      `${environmentName} must be either the direct staging endpoint ${expectedDirectHost}:5432 or the Supavisor session endpoint for ${stagingProjectRef}. Transaction poolers, production, and unknown hosts are rejected.`,
    );
  }

  return { databaseUrl, connectionMode: isDirectConnection ? "direct" : "supavisor-session" };
}

function databaseIdentity(databaseUrl) {
  return [databaseUrl.protocol, databaseUrl.hostname.toLowerCase(), databaseUrl.port, databaseUrl.username, databaseUrl.pathname].join("|");
}

function assertStagingDatabaseTarget(env = process.env, manifest = readBaselineManifest()) {
  const stagingProjectRef = manifest.staging_project_ref;
  const productionProjectRef = manifest.production_project_ref;

  // Do not let a GitHub Environment variable choose the database that a
  // history-writing workflow can touch. The reviewed manifest pins the only
  // allowed staging and production identities, and the URLs must prove they
  // point at the former.
  if (
    env.UPFLOW_STAGING_PROJECT_REF &&
    env.UPFLOW_STAGING_PROJECT_REF !== stagingProjectRef
  ) {
    fail("UPFLOW_STAGING_PROJECT_REF does not match the reviewed staging baseline manifest.");
  }
  if (
    env.UPFLOW_PRODUCTION_PROJECT_REF &&
    env.UPFLOW_PRODUCTION_PROJECT_REF !== productionProjectRef
  ) {
    fail("UPFLOW_PRODUCTION_PROJECT_REF does not match the reviewed staging baseline manifest.");
  }

  const directUrl = parseStagingDatabaseUrl(env.DIRECT_URL, "DIRECT_URL", stagingProjectRef);
  const databaseUrl = parseStagingDatabaseUrl(env.DATABASE_URL, "DATABASE_URL", stagingProjectRef);
  if (databaseIdentity(directUrl.databaseUrl) !== databaseIdentity(databaseUrl.databaseUrl)) {
    fail("DATABASE_URL and DIRECT_URL must point to the same isolated staging database target.");
  }

  return {
    stagingProjectRef,
    productionProjectRef,
    host: directUrl.databaseUrl.hostname.toLowerCase(),
    connectionMode: directUrl.connectionMode,
  };
}

function normalizeHistoryRow(row) {
  return {
    migration_name: row.migration_name,
    checksum: row.checksum,
    finished_at: row.finished_at,
    rolled_back_at: row.rolled_back_at,
  };
}

function classifyMigrationHistory(rows, expectedMigrations, { allowLaterMigrations = false } = {}) {
  const expectedMigrationNames = expectedMigrations.map((migration) =>
    typeof migration === "string" ? migration : migration.name,
  );
  const expectedChecksums = new Map(
    expectedMigrations
      .filter((migration) => typeof migration !== "string" && migration.sha256)
      .map((migration) => [migration.name, migration.sha256]),
  );
  const normalizedRows = rows.map(normalizeHistoryRow);
  const errors = [];
  const seenNames = new Set();

  for (const row of normalizedRows) {
    if (typeof row.migration_name !== "string" || !row.migration_name) {
      errors.push("A Prisma migration-history row has no migration name.");
      continue;
    }
    if (seenNames.has(row.migration_name)) {
      errors.push(`Prisma migration history contains duplicate entry ${row.migration_name}.`);
    }
    seenNames.add(row.migration_name);
    if (!row.finished_at) {
      errors.push(`Prisma migration ${row.migration_name} is unfinished.`);
    }
    if (row.rolled_back_at) {
      errors.push(`Prisma migration ${row.migration_name} is marked rolled back.`);
    }
    if (typeof row.checksum !== "string" || !row.checksum) {
      errors.push(`Prisma migration ${row.migration_name} is missing its checksum.`);
    }
  }

  const comparisonRows = allowLaterMigrations ? normalizedRows.slice(0, expectedMigrationNames.length) : normalizedRows;
  for (let index = 0; index < comparisonRows.length; index += 1) {
    const actualName = comparisonRows[index]?.migration_name;
    const expectedName = expectedMigrationNames[index];
    if (actualName !== expectedName) {
      errors.push(
        `Prisma migration history is not the expected ordered prefix at position ${index + 1}: expected ${expectedName ?? "no further migration"}, found ${actualName}.`,
      );
      break;
    }
    const expectedChecksum = expectedChecksums.get(actualName);
    if (expectedChecksum && normalizedRows[index].checksum !== expectedChecksum) {
      errors.push(`Prisma migration ${actualName} has a checksum that does not match the frozen baseline.`);
    }
  }

  if (!allowLaterMigrations && normalizedRows.length > expectedMigrationNames.length) {
    errors.push("Prisma migration history contains entries outside the frozen staging baseline.");
  }

  return {
    errors,
    isValid: errors.length === 0,
    isComplete: normalizedRows.length >= expectedMigrationNames.length &&
      expectedMigrationNames.every((name, index) => normalizedRows[index]?.migration_name === name),
    missingMigrationNames: expectedMigrationNames.slice(Math.min(normalizedRows.length, expectedMigrationNames.length)),
  };
}

function assertHistoryMatchesKnownMigrations(rows, expectedMigrations, localMigrationNames) {
  const expectedMigrationNames = expectedMigrations.map((migration) =>
    typeof migration === "string" ? migration : migration.name,
  );
  const classification = classifyMigrationHistory(rows, expectedMigrations, { allowLaterMigrations: true });
  const localMigrationNameSet = new Set(localMigrationNames);
  const unexpectedEntries = rows
    .map((row) => row.migration_name)
    .filter((migrationName) => !localMigrationNameSet.has(migrationName));

  if (unexpectedEntries.length > 0) {
    classification.errors.push(
      `Prisma migration history contains migrations absent from this checkout: ${sorted(unexpectedEntries).join(", ")}.`,
    );
    classification.isValid = false;
  }

  if (!classification.isComplete) {
    classification.errors.push(
      `The isolated staging database is not baselined. Run the manual Baseline cloned staging Prisma workflow before automatic staging releases.`,
    );
    classification.isValid = false;
  }

  return classification;
}

function quoteIdentifier(identifier) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
    fail(`Refusing to quote an unsafe database identifier: ${identifier}.`);
  }
  return `"${identifier}"`;
}

function getPrismaClient() {
  // Keep pure helper tests independent from a generated Prisma client.
  const { PrismaClient } = require("@prisma/client");
  return new PrismaClient();
}

async function readMigrationHistory(client) {
  return client.$queryRawUnsafe(`
    SELECT migration_name, checksum, finished_at, rolled_back_at
    FROM public."_prisma_migrations"
    ORDER BY started_at ASC, migration_name ASC
  `);
}

async function assertClonedSchemaSafety(client, expectedAppTables, requiredExtensions) {
  const expectedTables = sorted(["_prisma_migrations", ...expectedAppTables]);
  const tableRows = await client.$queryRawUnsafe(`
    SELECT c.relname AS table_name
    FROM pg_catalog.pg_class AS c
    INNER JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
    ORDER BY c.relname ASC
  `);
  const actualTables = tableRows.map((row) => row.table_name);
  const missing = expectedTables.filter((name) => !actualTables.includes(name));
  const extra = actualTables.filter((name) => !expectedTables.includes(name));
  if (missing.length > 0 || extra.length > 0) {
    fail(
      `The staging public-table set does not match the reviewed schema clone. Missing: ${missing.join(", ") || "none"}. Extra: ${extra.join(", ") || "none"}.`,
    );
  }

  const nonEmptyTables = [];
  for (const tableName of expectedAppTables) {
    const rows = await client.$queryRawUnsafe(
      `SELECT EXISTS (SELECT 1 FROM public.${quoteIdentifier(tableName)} LIMIT 1) AS has_rows`,
    );
    if (rows[0]?.has_rows) nonEmptyTables.push(tableName);
  }
  if (nonEmptyTables.length > 0) {
    fail(
      `The staging clone contains application data in ${nonEmptyTables.join(", ")}. Recreate or review the clone; do not skip data migrations by baselining it.`,
    );
  }

  const extensionLiterals = requiredExtensions.map((extension) => `'${extension}'`).join(", ");
  const extensionRows = await client.$queryRawUnsafe(
    `SELECT extname FROM pg_extension WHERE extname IN (${extensionLiterals}) ORDER BY extname ASC`,
  );
  const installedExtensions = extensionRows.map((row) => row.extname);
  const missingExtensions = sorted(requiredExtensions).filter((extension) => !installedExtensions.includes(extension));
  if (missingExtensions.length > 0) {
    fail(`The staging schema is missing required PostgreSQL extension(s): ${missingExtensions.join(", ")}.`);
  }

  const appTableLiterals = expectedAppTables.map((tableName) => `'${tableName}'`).join(", ");
  const rlsRows = await client.$queryRawUnsafe(`
    SELECT c.relname AS table_name
    FROM pg_catalog.pg_class AS c
    INNER JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'SidebarSpaceHide'
      AND NOT c.relrowsecurity
    ORDER BY c.relname ASC
  `);
  if (rlsRows.length > 0) {
    fail("Row-level security is not enabled on SidebarSpaceHide as required by its reviewed migration.");
  }

  const privilegeRows = await client.$queryRawUnsafe(`
    SELECT c.relname AS table_name, role_name.role_name
    FROM pg_catalog.pg_class AS c
    INNER JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
    CROSS JOIN (VALUES ('anon'::text), ('authenticated'::text)) AS role_name(role_name)
    WHERE n.nspname = 'public'
      AND c.relname IN (${appTableLiterals})
      AND (
        has_table_privilege(role_name.role_name, c.oid, 'SELECT') OR
        has_table_privilege(role_name.role_name, c.oid, 'INSERT') OR
        has_table_privilege(role_name.role_name, c.oid, 'UPDATE') OR
        has_table_privilege(role_name.role_name, c.oid, 'DELETE') OR
        has_table_privilege(role_name.role_name, c.oid, 'TRUNCATE') OR
        has_table_privilege(role_name.role_name, c.oid, 'REFERENCES') OR
        has_table_privilege(role_name.role_name, c.oid, 'TRIGGER')
      )
    ORDER BY c.relname ASC, role_name.role_name ASC
  `);
  if (privilegeRows.length > 0) {
    const grants = privilegeRows.map((row) => `${row.role_name} on ${row.table_name}`);
    fail(`Browser-facing Supabase roles still have table privileges: ${grants.join(", ")}.`);
  }

  const storageBucketRows = await client.$queryRawUnsafe(
    "SELECT public FROM storage.buckets WHERE id = 'task-assets' LIMIT 1",
  );
  if (storageBucketRows[0]?.public === true) {
    fail("The staging task-assets bucket is public. Make it private before baselining this clone.");
  }
}

function writeCapturedOutput(result) {
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
}

function runPrisma(args, env = process.env) {
  const result = spawnSync(prismaCommand, args, {
    cwd: APP_ROOT,
    env,
    encoding: "utf8",
    stdio: "pipe",
    shell: process.platform === "win32",
  });

  if (result.error) throw result.error;
  return result;
}

function assertSchemaMatchesPrismaDatamodel(env = process.env, schemaPath = SCHEMA_PATH) {
  const result = runPrisma(
    [
      "migrate",
      "diff",
      "--from-schema-datamodel",
      schemaPath,
      "--to-schema-datasource",
      schemaPath,
      "--exit-code",
    ],
    env,
  );

  if (result.status === 0) return;

  writeCapturedOutput(result);
  if (result.status === 2) {
    fail("The staging database differs from the Prisma datamodel. Correct the clone before recording migration history.");
  }
  fail("Prisma could not validate the staging database schema before baselining.");
}

async function validateClonedStagingDatabase(env = process.env) {
  const manifest = readBaselineManifest();
  const localMigrations = getLocalMigrations();
  const frozenSource = getFrozenBaselineSourcePaths(env);
  const frozenMigrations = getLocalMigrations(frozenSource.migrationsDirectory);

  // A newer staging checkout may contain feature migrations that the clone
  // does not have yet. Validate the clone only against the immutable source
  // snapshot, while still rejecting a modified historical migration locally.
  assertManifestMatchesCurrentMigrations(manifest, localMigrations, { exact: false });
  assertManifestMatchesCurrentMigrations(manifest, frozenMigrations, { exact: true });
  const target = assertStagingDatabaseTarget(env, manifest);
  const expectedAppTables = getExpectedAppTableNames(frozenSource.schemaPath);
  const client = getPrismaClient();

  try {
    await assertClonedSchemaSafety(client, expectedAppTables, manifest.required_extensions);
    assertSchemaMatchesPrismaDatamodel(env, frozenSource.schemaPath);
    return { manifest, frozenMigrations, frozenSource, localMigrations, target };
  } finally {
    await client.$disconnect();
  }
}

async function assertStagingBaseline(env = process.env) {
  const manifest = readBaselineManifest();
  const localMigrations = getLocalMigrations();
  assertManifestMatchesCurrentMigrations(manifest, localMigrations, { exact: false });
  assertStagingDatabaseTarget(env, manifest);

  const client = getPrismaClient();
  try {
    const rows = await readMigrationHistory(client);
    const classification = assertHistoryMatchesKnownMigrations(
      rows,
      manifest.migrations,
      localMigrations.map((migration) => migration.name),
    );
    if (!classification.isValid) {
      fail(classification.errors.join("\n"));
    }
  } finally {
    await client.$disconnect();
  }
}

async function baselineClonedStaging(env = process.env) {
  if (env.GITHUB_REF !== STAGING_REF) {
    fail(`The one-time staging baseline can run only from ${STAGING_REF}.`);
  }
  if (env.STAGING_PRISMA_BASELINE_CONFIRMATION !== BASELINE_CONFIRMATION) {
    fail(`Set STAGING_PRISMA_BASELINE_CONFIRMATION to ${BASELINE_CONFIRMATION} to authorize this history-only operation.`);
  }

  const { frozenSource, manifest } = await validateClonedStagingDatabase(env);
  const expectedMigrationNames = manifest.migrations.map((migration) => migration.name);
  const client = getPrismaClient();

  try {
    const beforeRows = await readMigrationHistory(client);
    const before = classifyMigrationHistory(beforeRows, manifest.migrations);
    if (!before.isValid) {
      fail(before.errors.join("\n"));
    }

    for (const migrationName of before.missingMigrationNames) {
      const result = runPrisma(
        ["migrate", "resolve", "--schema", frozenSource.schemaPath, "--applied", migrationName],
        env,
      );
      writeCapturedOutput(result);
      if (result.status !== 0) {
        fail(`Prisma could not record ${migrationName} as applied. No further migration history was changed.`);
      }
    }

    const status = runPrisma(["migrate", "status", "--schema", frozenSource.schemaPath], env);
    writeCapturedOutput(status);
    if (status.status !== 0) {
      fail("Prisma migration status is not current after the staging baseline.");
    }

    const afterRows = await readMigrationHistory(client);
    const after = classifyMigrationHistory(afterRows, manifest.migrations);
    if (!after.isValid || !after.isComplete || afterRows.length !== expectedMigrationNames.length) {
      fail(`Staging migration history does not exactly match the frozen baseline. ${after.errors.join(" ")}`);
    }

    console.log(`Recorded ${expectedMigrationNames.length} reviewed migrations for the isolated staging clone.`);
  } finally {
    await client.$disconnect();
  }
}

module.exports = {
  APP_ROOT,
  BASELINE_CONFIRMATION,
  MANIFEST_PATH,
  STAGING_REF,
  assertManifestMatchesCurrentMigrations,
  assertStagingBaseline,
  assertStagingDatabaseTarget,
  baselineClonedStaging,
  classifyMigrationHistory,
  getExpectedAppTableNames,
  getFrozenBaselineSourcePaths,
  getLocalMigrations,
  readBaselineManifest,
  validateClonedStagingDatabase,
};
