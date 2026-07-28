const { assertStagingBaseline } = require("./staging-prisma-baseline.cjs");

assertStagingBaseline().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
