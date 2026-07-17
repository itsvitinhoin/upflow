const { PrismaClient } = require("@prisma/client");

function describeConnection(name, raw) {
  if (!raw?.trim()) {
    throw new Error(`${name} is not configured`);
  }
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${name} is not a valid PostgreSQL connection string`);
  }
  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    throw new Error(`${name} must use postgres:// or postgresql://`);
  }
  if (!url.password) {
    throw new Error(`${name} is missing a database password`);
  }
  return {
    host: url.hostname,
    port: url.port || "5432",
    username: url.username,
  };
}

async function verify(name, raw) {
  const detail = describeConnection(name, raw);
  const client = new PrismaClient({ datasources: { db: { url: raw } } });
  try {
    await client.$queryRawUnsafe("SELECT 1");
    console.log(`${name}: connected to ${detail.host}:${detail.port} as ${detail.username}`);
  } finally {
    await client.$disconnect();
  }
}

async function main() {
  await verify("DATABASE_URL", process.env.DATABASE_URL);
  await verify("DIRECT_URL", process.env.DIRECT_URL);
}

main().catch((error) => {
  console.error(`Database verification failed: ${error.message}`);
  process.exitCode = 1;
});
