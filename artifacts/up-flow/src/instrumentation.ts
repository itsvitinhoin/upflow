// Next.js calls `register()` once at server startup (both `next dev` and
// `next start`). Importing `env` here guarantees env validation runs before
// any request is served — in production this throws and aborts boot if any
// required variable is missing.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("@/lib/env");
  }
}
