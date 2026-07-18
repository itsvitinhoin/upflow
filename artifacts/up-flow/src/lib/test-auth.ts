/**
 * Dev/CI-only login bypass for the Playwright suite. It is enabled during
 * local development when `TEST_LOGIN_TOKEN` is present. A production-mode
 * test server must additionally be an explicitly marked GitHub Actions run
 * and cannot be a Vercel deployment.
 *
 * Cookie value is `<base64url(email)>.<hmac-sha256(email, TEST_LOGIN_TOKEN)>`
 * (Web Crypto so it works in both the Edge runtime middleware and the
 * Node runtime app routes).
 */

export const TEST_AUTH_COOKIE = "upflow_test_user";

function testLoginEnabled(): boolean {
  if (!process.env.TEST_LOGIN_TOKEN) return false;
  if (process.env.NODE_ENV !== "production") return true;

  return (
    process.env.E2E_TEST_AUTH_BYPASS === "1" &&
    process.env.CI === "true" &&
    process.env.GITHUB_ACTIONS === "true" &&
    process.env.VERCEL !== "1"
  );
}

const enc = new TextEncoder();

function b64url(bytes: Uint8Array | ArrayBuffer): string {
  const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (let i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): string {
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  const std = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return atob(std);
}

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return b64url(sig);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function signTestAuthCookie(email: string): Promise<string | null> {
  if (!testLoginEnabled()) return null;
  const sig = await hmac(process.env.TEST_LOGIN_TOKEN!, email);
  return `${b64url(enc.encode(email))}.${sig}`;
}

export async function verifyTestAuthCookie(
  value: string | undefined,
): Promise<string | null> {
  if (!value || !testLoginEnabled()) return null;
  const parts = value.split(".");
  if (parts.length !== 2) return null;
  let email: string;
  try {
    email = b64urlDecode(parts[0]);
  } catch {
    return null;
  }
  if (!email.includes("@")) return null;
  const expected = await hmac(process.env.TEST_LOGIN_TOKEN!, email);
  return timingSafeEqual(expected, parts[1]) ? email : null;
}

export function isTestLoginEnabled(): boolean {
  return testLoginEnabled();
}
