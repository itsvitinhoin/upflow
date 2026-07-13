import { rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const file of ["package-lock.json", "yarn.lock"]) {
  rmSync(join(root, file), { force: true });
}

const userAgent = process.env.npm_config_user_agent ?? "";
if (!userAgent.startsWith("pnpm/")) {
  console.error("Use pnpm instead");
  process.exit(1);
}
