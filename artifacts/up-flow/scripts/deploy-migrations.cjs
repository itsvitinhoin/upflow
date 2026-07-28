const { spawnSync } = require("node:child_process");
const { getMigrationDatabaseUrl } = require("./migration-database-url.cjs");

const isWindows = process.platform === "win32";
const prismaCommand = isWindows ? "prisma.cmd" : "prisma";
const invokedFromBuild = process.env.npm_lifecycle_event === "build";
const shouldFallbackToDatabaseUrl = process.env.PRISMA_MIGRATION_FALLBACK_TO_DATABASE_URL === "1";

if (invokedFromBuild || process.env.VERCEL === "1") {
  console.error(
    "Refusing to run Prisma migrations from an application build or Vercel. " +
      "Run pnpm db:migrate:deploy from the release runner before promoting the deployment.",
  );
  process.exit(1);
}

if (process.env.PRISMA_BASELINE_EXISTING_DB === "1") {
  console.error(
    "PRISMA_BASELINE_EXISTING_DB has been retired because its partial history write is unsafe. " +
      "Use the one-time Baseline cloned staging Prisma history workflow for the reviewed staging clone.",
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

runMigrateDeploy();
