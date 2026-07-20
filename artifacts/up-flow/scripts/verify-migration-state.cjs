const { spawnSync } = require("node:child_process");

const isWindows = process.platform === "win32";
const prismaCommand = isWindows ? "prisma.cmd" : "prisma";

function shouldVerifyMigrationState(env = process.env) {
  return env.VERCEL === "1";
}

function verifyMigrationState(env = process.env) {
  if (!shouldVerifyMigrationState(env)) return;

  if (!env.DATABASE_URL && !env.DIRECT_URL) {
    console.error(
      "Production deployment blocked: DATABASE_URL or DIRECT_URL is required to verify Prisma migration state.",
    );
    process.exit(1);
  }

  const result = spawnSync(prismaCommand, ["migrate", "status"], {
    stdio: "inherit",
    shell: isWindows,
    env,
  });

  if (result.error) throw result.error;

  if (result.status !== 0) {
    console.error(
      "Production deployment blocked: the database has pending or failed Prisma migrations. " +
        "Apply the reviewed migration through the Controlled Production Release workflow, then redeploy.",
    );
    process.exit(result.status ?? 1);
  }
}

if (require.main === module) {
  verifyMigrationState();
}

module.exports = { shouldVerifyMigrationState };
