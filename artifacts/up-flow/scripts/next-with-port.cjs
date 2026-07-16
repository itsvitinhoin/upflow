const { spawn } = require("node:child_process");

const command = process.argv[2];
if (command !== "dev" && command !== "start") {
  console.error("Usage: node scripts/next-with-port.cjs <dev|start>");
  process.exit(1);
}

const nextBin = process.platform === "win32" ? "next.cmd" : "next";
const child = spawn(
  nextBin,
  [command, "-H", "0.0.0.0", "-p", process.env.PORT || "3000"],
  { stdio: "inherit" },
);

child.once("error", (error) => {
  console.error("Unable to start Next.js:", error.message);
  process.exit(1);
});

child.once("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
