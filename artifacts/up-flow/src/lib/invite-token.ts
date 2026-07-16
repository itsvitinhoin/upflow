import { createHash, randomBytes } from "node:crypto";

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function generateInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashInviteToken(token: string | null | undefined): string | null {
  const normalized = token?.trim();
  // Existing invite links used a 24-byte base64url token (32 characters).
  // Keep that format valid during the migration while rejecting junk input.
  if (!normalized || !/^[A-Za-z0-9_-]{32,128}$/.test(normalized)) return null;
  return createHash("sha256").update(normalized).digest("hex");
}

export function inviteExpiry(now = new Date()): Date {
  return new Date(now.getTime() + INVITE_TTL_MS);
}

export function isInviteExpired(expiresAt: Date, now = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime();
}

export function maskInviteEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "hidden email";
  const visible = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(1, local.length - visible.length))}@${domain}`;
}
