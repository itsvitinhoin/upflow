function isSupabaseTransactionPooler(url: URL): boolean {
  return (
    url.port === "6543" &&
    url.hostname.toLowerCase().endsWith(".pooler.supabase.com")
  );
}

/**
 * Adds Prisma connection options required by the serverless Supabase runtime.
 * Supavisor transaction mode cannot use Prisma prepared statements.
 */
export function toPrismaRuntimeDatabaseUrl(rawUrl: string): string {
  if (!rawUrl) return "";

  try {
    const url = new URL(rawUrl);
    if (isSupabaseTransactionPooler(url)) {
      url.searchParams.set("pgbouncer", "true");
    }
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
