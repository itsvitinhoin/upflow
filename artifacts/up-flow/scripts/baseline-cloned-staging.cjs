const { baselineClonedStaging } = require("./staging-prisma-baseline.cjs");

baselineClonedStaging().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
