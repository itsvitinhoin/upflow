function getMigrationDatabaseUrl(databaseUrl) {
  if (!databaseUrl) return databaseUrl;

  try {
    const url = new URL(databaseUrl);
    const isSupabaseTransactionPooler =
      url.hostname.endsWith(".pooler.supabase.com") && url.port === "6543";

    if (!isSupabaseTransactionPooler) return databaseUrl;

    url.port = "5432";
    url.searchParams.delete("pgbouncer");
    return url.toString();
  } catch {
    return databaseUrl;
  }
}

module.exports = { getMigrationDatabaseUrl };
