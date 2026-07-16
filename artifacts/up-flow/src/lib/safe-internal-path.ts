const FALLBACK_PATH = "/";

/**
 * Accept only a same-origin, single-slash application path. This keeps auth
 * redirects from treating protocol-relative or encoded external URLs as local.
 */
export function safeInternalPath(value: string | null | undefined, fallback = FALLBACK_PATH): string {
  if (!value || !value.startsWith("/")) return fallback;
  if (
    value.startsWith("//") ||
    value.includes("\\") ||
    /%2f|%5c/i.test(value)
  ) {
    return fallback;
  }

  try {
    const base = "https://upflow.invalid";
    const parsed = new URL(value, base);
    if (parsed.origin !== base) return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
