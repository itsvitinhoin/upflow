const REQUIRED = [
  "DATABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const;

const OPTIONAL = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "CLICKUP_API_TOKEN",
  "ADMIN_EMAILS",
] as const;

let validated = false;

export class MissingEnvError extends Error {
  constructor(missing: readonly string[]) {
    super(
      `[env] missing required environment variables: ${missing.join(", ")}. ` +
        `Set them in your environment before starting the server.`,
    );
    this.name = "MissingEnvError";
  }
}

export function validateEnv(): { ok: boolean; missing: string[] } {
  const missing = REQUIRED.filter((k) => !process.env[k]);
  if (!validated) {
    validated = true;
    const missingOptional = OPTIONAL.filter((k) => !process.env[k]);
    if (missingOptional.length > 0) {
      console.info(
        `[env] optional environment variables not set: ${missingOptional.join(", ")}`,
      );
    }
    if (missing.length > 0) {
      if (process.env.NODE_ENV === "production") {
        throw new MissingEnvError(missing);
      }
      console.warn(
        `[env] missing required environment variables (dev only, not fatal): ${missing.join(", ")}`,
      );
    }
  }
  return { ok: missing.length === 0, missing };
}

validateEnv();
