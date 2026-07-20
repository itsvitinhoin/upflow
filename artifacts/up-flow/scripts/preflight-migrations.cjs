const { spawnSync } = require("node:child_process");

const isWindows = process.platform === "win32";
const prismaCommand = isWindows ? "prisma.cmd" : "prisma";

function canProceedWithPendingMigrations(output) {
  return (
    output.includes("Following migration have not yet been applied:") &&
    !output.includes("Following migration have failed")
  );
}

function writeCapturedOutput(result) {
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
}

function preflightMigrations() {
  const result = spawnSync(prismaCommand, ["migrate", "status"], {
    stdio: "pipe",
    encoding: "utf8",
    shell: isWindows,
    env: process.env,
  });

  if (result.error) throw result.error;

  writeCapturedOutput(result);

  if (result.status === 0) {
    console.log("Prisma migration state is current.");
    return;
  }

  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (canProceedWithPendingMigrations(output)) {
    console.log("Reviewed pending Prisma migrations detected; migration deploy may proceed.");
    return;
  }

  console.error("Migration preflight failed. Resolve the database migration state before releasing.");
  process.exit(result.status ?? 1);
}

if (require.main === module) {
  preflightMigrations();
}

module.exports = { canProceedWithPendingMigrations };
