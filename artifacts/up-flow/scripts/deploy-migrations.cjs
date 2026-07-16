const { spawnSync } = require("node:child_process");
const { getMigrationDatabaseUrl } = require("./migration-database-url.cjs");

const baselineMigrations = [
  "20260512150000_add_spaces",
  "20260512170000_add_folders",
  "20260512190000_add_clickup_ids",
  "20260512200000_add_custom_fields",
  "20260515200000_add_workspaces",
  "20260518000000_notification_workspace_events",
  "20260519000000_add_departments",
  "20260519100000_notification_status_mention",
  "20260519170000_remove_clickup_ids",
];

const isWindows = process.platform === "win32";
const prismaCommand = isWindows ? "prisma.cmd" : "prisma";
const shouldBaseline = process.env.PRISMA_BASELINE_EXISTING_DB === "1";
const invokedFromBuild = process.env.npm_lifecycle_event === "build";
const shouldFallbackToDatabaseUrl = process.env.PRISMA_MIGRATION_FALLBACK_TO_DATABASE_URL === "1";

if (invokedFromBuild || process.env.VERCEL === "1") {
  console.error(
    "Refusing to run Prisma migrations from an application build or Vercel. " +
      "Run pnpm db:migrate:deploy from the release runner before promoting the deployment.",
  );
  process.exit(1);
}

function writeCapturedOutput(result) {
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
}

function runPrisma(args, options = {}) {
  const result = spawnSync(prismaCommand, args, {
    stdio: options.allowFailure ? "pipe" : "inherit",
    encoding: "utf8",
    shell: isWindows,
    env: options.env ?? process.env,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0 && !options.allowFailure) {
    process.exit(result.status ?? 1);
  }

  return result;
}

function runMigrateDeploy() {
  const result = runPrisma(["migrate", "deploy"], {
    allowFailure: shouldFallbackToDatabaseUrl,
  });

  if (result.status === 0) {
    return;
  }

  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  writeCapturedOutput(result);

  if (
    shouldFallbackToDatabaseUrl &&
    output.includes("P1001") &&
    process.env.DATABASE_URL
  ) {
    console.log("Direct database URL was unreachable. Retrying migrate deploy with DATABASE_URL as DIRECT_URL.");
    const migrationDatabaseUrl = getMigrationDatabaseUrl(process.env.DATABASE_URL);
    runPrisma(["migrate", "deploy"], {
      env: {
        ...process.env,
        DIRECT_URL: migrationDatabaseUrl,
      },
    });
    return;
  }

  process.exit(result.status ?? 1);
}

if (shouldBaseline) {
  console.log("Baselining existing production database migrations...");

  for (const migration of baselineMigrations) {
    const result = runPrisma(["migrate", "resolve", "--applied", migration], {
      allowFailure: true,
    });

    if (result.status === 0) {
      console.log(`Marked ${migration} as applied.`);
    } else {
      const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
      const alreadyApplied = output.includes("P3008") || output.includes("already recorded as applied");

      if (alreadyApplied) {
        console.log(`${migration} is already applied.`);
      } else {
        console.log(`Could not mark ${migration}; continuing so migrate deploy can report the final state.`);
      }
    }
  }
}

runMigrateDeploy();
