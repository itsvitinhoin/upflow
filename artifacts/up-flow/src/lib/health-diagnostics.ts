import { timingSafeEqual } from "node:crypto";

export function hasInternalHealthAccess(
  authorization: string | null,
  configuredSecret: string | undefined,
): boolean {
  const secret = configuredSecret?.trim();
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();
  if (!secret || !token) return false;

  const expected = Buffer.from(secret);
  const provided = Buffer.from(token);
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}

export function databaseErrorCode(error: unknown): string {
  const candidate = error as { code?: unknown; errorCode?: unknown } | null;
  const code = candidate?.code ?? candidate?.errorCode;
  return typeof code === "string" && /^P\d{4}$/.test(code) ? code : "UNKNOWN";
}
