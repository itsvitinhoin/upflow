import type { NextRequest } from "next/server";

/**
 * Build the absolute base URL used in *outbound emails* (invite accept
 * links, password-reset links). These addresses are security-sensitive —
 * a poisoned origin lets an attacker hijack reset tokens or send invite
 * accept clicks to a fake clone.
 *
 * Policy:
 *   - In production we REQUIRE `APP_URL` and never fall back to request
 *     headers (Host/Origin are attacker-controllable behind a proxy).
 *   - In development we fall back to the request origin so contributors
 *     can use the Replit preview URL without setting APP_URL manually.
 *
 * Throws `EmailOriginError` when APP_URL is missing in production. Callers
 * should catch it, log via `logError`, and skip the send rather than 500
 * the user-facing request.
 */
export class EmailOriginError extends Error {
  constructor() {
    super(
      "APP_URL must be set in production before sending links via email. " +
        "Set it to the canonical public origin of the app (no trailing slash).",
    );
    this.name = "EmailOriginError";
  }
}

export function getEmailOrigin(req: NextRequest): string {
  const configured = process.env.APP_URL?.trim().replace(/\/$/, "");
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new EmailOriginError();
  }
  const headerOrigin = req.headers.get("origin");
  if (headerOrigin) return headerOrigin.replace(/\/$/, "");
  const host = req.headers.get("host") ?? "localhost";
  return `http://${host}`;
}
