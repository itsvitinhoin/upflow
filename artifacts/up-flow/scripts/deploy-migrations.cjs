const { spawnSync } = require("node:child_process");

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
const shouldRunOnVercel = process.env.RUN_PRISMA_MIGRATIONS === "1";

if (process.env.VERCEL === "1" && !shouldRunOnVercel) {
  console.log("Skipping Prisma migrations during Vercel build. Run migrations manually or set RUN_PRISMA_MIGRATIONS=1.");
  process.exit(0);
}

function runPrisma(args, options = {}) {
  const result = spawnSync(prismaCommand, args, {
    stdio: options.allowFailure ? "pipe" : "inherit",
    encoding: "utf8",
    shell: isWindows,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0 && !options.allowFailure) {
    process.exit(result.status ?? 1);
  }

  return result;
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

runPrisma(["migrate", "deploy"]);
