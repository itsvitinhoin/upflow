/**
 * Browser-side Sentry init. Picked up automatically by `@sentry/nextjs`.
 * No-op when SENTRY_DSN_PUBLIC is missing so the bundle adds zero network
 * traffic in dev / unconfigured environments.
 */
import * as Sentry from "@sentry/nextjs";
import { markInitialized } from "@/lib/error-tracker";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const release =
  process.env.NEXT_PUBLIC_SENTRY_RELEASE ??
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA;

if (dsn) {
  Sentry.init({
    dsn,
    release,
    environment: process.env.NODE_ENV,
    tracesSampleRate: Number(
      process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? "0.1",
    ),
    sendDefaultPii: false,
    beforeSend(event) {
      // Defense-in-depth: scrub a few obvious leaks before they leave the
      // browser. Don't expose URLs containing reset-tokens etc.
      if (event.request?.url) {
        event.request.url = event.request.url.replace(/([?&](?:token|code)=)[^&]+/gi, "$1[redacted]");
      }
      if (event.user) {
        delete event.user.email;
        event.user.ip_address = null;
      }
      return event;
    },
  });
  markInitialized();
}
