import type { NextRequest } from "next/server";

/**
 * Build the absolute base URL used in *outbound emails* (invite accept
 * links, password-reset links). These addresses are security-sensitive —
 * a poisoned origin lets an attacker hijack reset tokens or send invite
 * accept clicks to a fake clone.
 *
 * Policy:
 *   - In production we use a valid `APP_URL`, or Vercel's canonical project
 *     production hostname when Vercel exposes it. We never fall back to
 *     request headers (Host/Origin are attacker-controllable behind a proxy).
 *   - In development we fall back to the request origin so contributors
 *     can use the Replit preview URL without setting APP_URL manually.
 *
 * Throws `EmailOriginError` when no trusted production origin is available.
 * Callers should catch it, log via `logError`, and skip the send rather than
 * 500 the user-facing request.
 */
export class EmailOriginError extends Error {
  constructor(message?: string) {
    super(
      message ??
        "APP_URL must be set to the canonical public origin of the app before sending links via email.",
    );
    this.name = "EmailOriginError";
  }
}

export type EmailOriginSource = "app-url" | "vercel-production-url" | null;

export type EmailOriginResolution = {
  origin: string | null;
  source: EmailOriginSource;
  problem: string | null;
};

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.startsWith("127.") ||
    normalized === "::1" ||
    normalized === "[::1]" ||
    normalized === "0.0.0.0"
  );
}

function parsePublicOrigin(value: string, label: string): { origin: string | null; problem: string | null } {
  try {
    const parsed = new URL(value);
    if (process.env.NODE_ENV === "production") {
      if (parsed.protocol !== "https:") {
        return { origin: null, problem: `${label} must use HTTPS in production.` };
      }
      if (isLoopbackHostname(parsed.hostname)) {
        return {
          origin: null,
          problem: `${label} cannot point to localhost or a loopback address in production.`,
        };
      }
    }
    return { origin: parsed.origin, problem: null };
  } catch {
    return {
      origin: null,
      problem: `${label} must be a valid absolute URL, for example https://upflow-mocha.vercel.app.`,
    };
  }
}

/**
 * Resolve the trusted origin used in outbound email links. APP_URL remains
 * authoritative. When it is absent or unsafe in a Vercel production runtime,
 * Vercel's own canonical production hostname is a safe recovery fallback.
 */
export function resolveEmailOrigin(): EmailOriginResolution {
  const appUrl = process.env.APP_URL?.trim().replace(/\/$/, "");
  if (appUrl) {
    const parsed = parsePublicOrigin(appUrl, "APP_URL");
    if (parsed.origin) {
      return { origin: parsed.origin, source: "app-url", problem: null };
    }

    if (process.env.NODE_ENV !== "production") {
      return { origin: null, source: null, problem: parsed.problem };
    }

    const fallback = resolveVercelProductionOrigin();
    if (fallback) {
      return { origin: fallback, source: "vercel-production-url", problem: parsed.problem };
    }
    return { origin: null, source: null, problem: parsed.problem };
  }

  if (process.env.NODE_ENV === "production") {
    const fallback = resolveVercelProductionOrigin();
    if (fallback) {
      return {
        origin: fallback,
        source: "vercel-production-url",
        problem: "APP_URL is not set.",
      };
    }
    return {
      origin: null,
      source: null,
      problem:
        "APP_URL must be set in production before sending links via email. " +
        "Set it to the canonical public origin of the app (no trailing slash).",
    };
  }

  return { origin: null, source: null, problem: null };
}

function resolveVercelProductionOrigin(): string | null {
  const configured = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (!configured) return null;

  const value = configured.includes("://") ? configured : `https://${configured}`;
  return parsePublicOrigin(value, "VERCEL_PROJECT_PRODUCTION_URL").origin;
}

export function getEmailOrigin(req: NextRequest): string {
  const configured = resolveEmailOrigin();
  if (configured.origin) return configured.origin;
  if (process.env.NODE_ENV === "production") {
    throw new EmailOriginError(configured.problem ?? undefined);
  }
  const headerOrigin = req.headers.get("origin");
  if (headerOrigin) return headerOrigin.replace(/\/$/, "");
  const host = req.headers.get("host") ?? "localhost";
  return `http://${host}`;
}
