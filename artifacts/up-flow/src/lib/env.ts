const REQUIRED = [
  "DATABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const;

const PRODUCTION_REQUIRED = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "APP_URL",
  "CRON_SECRET",
  "SENTRY_DSN",
  "NEXT_PUBLIC_SENTRY_DSN",
] as const;

const OPTIONAL = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "ADMIN_EMAILS",
  // Transactional email. When unset, sendEmail() logs to the server console
  // instead of calling Resend so local dev keeps working without a key.
  "RESEND_API_KEY",
  "EMAIL_FROM",
  // Public base URL used to build absolute links in outbound emails
  // (invite accept URLs, password reset URLs). Falls back to the request
  // origin when missing, which is fine in dev.
  "APP_URL",
  // Shared secret required by production cron endpoints.
  "CRON_SECRET",
  // Shared rate-limit store. It is mandatory in production and optional in
  // local development, where rate-limit.ts uses a short-lived memory store.
  "REDIS_URL",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  // Error tracking. When unset, error-tracker.ts is a no-op so local dev
  // works without an external service. NEXT_PUBLIC_SENTRY_DSN enables the
  // browser SDK; SENTRY_DSN enables the server SDK.
  "SENTRY_DSN",
  "NEXT_PUBLIC_SENTRY_DSN",
  "SENTRY_RELEASE",
  "NEXT_PUBLIC_SENTRY_RELEASE",
  "SENTRY_TRACES_SAMPLE_RATE",
  "NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE",
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
  const production = process.env.NODE_ENV === "production";
  const hasRedis = Boolean(process.env.REDIS_URL?.trim());
  const hasUpstash = Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() &&
      process.env.UPSTASH_REDIS_REST_TOKEN?.trim(),
  );
  const missing = [
    ...REQUIRED.filter((k) => !process.env[k]),
    ...(production
      ? PRODUCTION_REQUIRED.filter((k) => !process.env[k])
      : []),
    ...(production && !hasRedis && !hasUpstash
      ? ["REDIS_URL or UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN"]
      : []),
  ];
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
