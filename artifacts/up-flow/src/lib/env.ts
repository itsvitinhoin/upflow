const REQUIRED = [
  "DATABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const;

const OPTIONAL = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "CLICKUP_API_TOKEN",
] as const;

let validated = false;

export function validateEnv(): { ok: boolean; missing: string[] } {
  const missing = REQUIRED.filter((k) => !process.env[k]);
  if (!validated) {
    validated = true;
    if (missing.length > 0) {
      console.warn(
        `[env] missing required environment variables: ${missing.join(", ")}`
      );
    }
    const missingOptional = OPTIONAL.filter((k) => !process.env[k]);
    if (missingOptional.length > 0) {
      console.info(
        `[env] optional environment variables not set: ${missingOptional.join(", ")}`
      );
    }
  }
  return { ok: missing.length === 0, missing };
}

validateEnv();
