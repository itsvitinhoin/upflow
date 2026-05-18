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
    // Observability readiness gate (production only). We don't want a prod
    // build to silently ship with no error tracking, but we also don't
    // want to wedge deployments that intentionally opt out (e.g. internal
    // staging mirror). Require either SENTRY_DSN to be set OR an explicit
    // `OBSERVABILITY_DISABLED=1` ack.
    if (
      process.env.NODE_ENV === "production" &&
      !process.env.SENTRY_DSN &&
      process.env.OBSERVABILITY_DISABLED !== "1"
    ) {
      throw new MissingEnvError([
        "SENTRY_DSN (or set OBSERVABILITY_DISABLED=1 to acknowledge)",
      ]);
    }
  }
  return { ok: missing.length === 0, missing };
}

validateEnv();
