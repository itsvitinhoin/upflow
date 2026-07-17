import assert from "node:assert/strict";
import test from "node:test";
import { toPrismaRuntimeDatabaseUrl } from "../../src/lib/prisma-url";

test("enables PgBouncer compatibility for the Supabase transaction pooler", () => {
  const rawUrl =
    "postgresql://postgres.project:example@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?sslmode=require";

  const url = new URL(toPrismaRuntimeDatabaseUrl(rawUrl));

  assert.equal(url.searchParams.get("pgbouncer"), "true");
  assert.equal(url.searchParams.get("connection_limit"), "1");
  assert.equal(url.searchParams.get("pool_timeout"), "20");
  assert.equal(url.searchParams.get("sslmode"), "require");
});

test("does not apply PgBouncer mode to non-transaction URLs", () => {
  const sessionPoolerUrl =
    "postgresql://postgres.project:example@aws-1-sa-east-1.pooler.supabase.com:5432/postgres";
  const directUrl = "postgresql://postgres:example@db.project.supabase.co:5432/postgres";

  assert.equal(
    new URL(toPrismaRuntimeDatabaseUrl(sessionPoolerUrl)).searchParams.has("pgbouncer"),
    false,
  );
  assert.equal(
    new URL(toPrismaRuntimeDatabaseUrl(directUrl)).searchParams.has("pgbouncer"),
    false,
  );
});

test("keeps malformed database URLs unchanged", () => {
  assert.equal(toPrismaRuntimeDatabaseUrl("not-a-database-url"), "not-a-database-url");
});
