/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === "production";

// Baseline CSP. We keep `unsafe-inline` for styles (Tailwind + Radix inline
// styles) and `unsafe-eval` only in dev (Next's RSC dev runtime needs it).
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  // Sentry ingest endpoints must be reachable from the browser so client-side
  // uncaught errors actually arrive. Cover the regional ingest hostnames
  // ({region}.ingest.sentry.io and the bare ingest.sentry.io).
  `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://ingest.sentry.io${isProd ? "" : " http://localhost:54321 ws://localhost:54321"}`,
].join("; ");

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy", value: csp },
];

const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["@prisma/client", "prisma"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

// `withSentryConfig` is what actually injects `sentry.client.config.ts` into
// the client bundle and wires source-map upload at build time. Without this
// wrapper the client config file is dead code — browser uncaught errors
// would never reach the tracker even with NEXT_PUBLIC_SENTRY_DSN set. We
// import dynamically so the dev/CI path that hasn't installed @sentry/nextjs
// (e.g. lint-only) still works; if the import fails we fall back to the
// bare config.
let exported = nextConfig;
try {
  const { withSentryConfig } = await import("@sentry/nextjs");
  exported = withSentryConfig(nextConfig, {
    // Build-time options. Keep silent unless explicitly enabled so CI logs
    // stay clean when no DSN/auth-token is configured.
    silent: !process.env.SENTRY_AUTH_TOKEN,
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    authToken: process.env.SENTRY_AUTH_TOKEN,
    // Only upload source maps when explicitly opted in (auth token present).
    sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  });
} catch {
  // @sentry/nextjs not available — observability disabled by env gate.
}

export default exported;
