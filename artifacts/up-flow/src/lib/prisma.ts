import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function withPrismaPoolLimits(rawUrl: string): string {
  if (!rawUrl) return "";

  try {
    const url = new URL(rawUrl);
    if (!url.searchParams.has("connection_limit")) {
      url.searchParams.set("connection_limit", "1");
    }
    if (!url.searchParams.has("pool_timeout")) {
      url.searchParams.set("pool_timeout", "20");
    }
    return url.toString();
  } catch {
    return rawUrl;
  }
}

function getDatabaseUrl(): string {
  if (process.env.DATABASE_URL) {
    return withPrismaPoolLimits(process.env.DATABASE_URL);
  }

  if (process.env.PGHOST && process.env.PGUSER && process.env.PGPASSWORD && process.env.PGDATABASE) {
    const port = process.env.PGPORT || "5432";
    return withPrismaPoolLimits(
      `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${port}/${process.env.PGDATABASE}`,
    );
  }

  return "";
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: getDatabaseUrl(),
      },
    },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
