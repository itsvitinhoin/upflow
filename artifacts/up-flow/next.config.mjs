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
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.clickup.com https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://ingest.sentry.io",
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
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "prisma"],
    instrumentationHook: true,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
