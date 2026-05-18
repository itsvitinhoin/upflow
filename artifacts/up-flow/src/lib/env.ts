const REQUIRED = [
  "DATABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const;

const OPTIONAL = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "CLICKUP_API_TOKEN",
  "ADMIN_EMAILS",
  // Transactional email. When unset, sendEmail() logs to the server console
  // instead of calling Resend so local dev keeps working without a key.
  "RESEND_API_KEY",
  "EMAIL_FROM",
  // Public base URL used to build absolute links in outbound emails
  // (invite accept URLs, password reset URLs). Falls back to the request
  // origin when missing, which is fine in dev.
  "APP_URL",
  // Shared rate-limit store. When unset, rate-limit.ts falls back to an
  // in-process Map and logs a degraded-protection warning at startup.
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
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
