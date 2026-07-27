import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

// This module imports node:crypto and must only be used by Node route handlers.

const STATE_VERSION = 2;
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const MAX_STATE_LENGTH = 4096;
const MAX_TOKEN_HASH_LENGTH = 1024;
export const PASSWORD_RECOVERY_STATE_TTL_SECONDS = 60 * 60;
const PASSWORD_RECOVERY_STATE_PURPOSE = "password-recovery";

type PasswordRecoveryStatePayload = {
  version: typeof STATE_VERSION;
  purpose: typeof PASSWORD_RECOVERY_STATE_PURPOSE;
  audience: string;
  expiresAt: number;
  tokenHash: string;
};

export type CreatePasswordRecoveryStateOptions = {
  appOrigin: string;
  tokenHash: string;
  secret: string;
  now?: number;
};

export type ReadPasswordRecoveryStateOptions = {
  state: string;
  secret: string | undefined;
  now?: number;
};

export type CreatePasswordRecoveryStateConfirmationUrlOptions = CreatePasswordRecoveryStateOptions;

export type ReadPasswordRecoveryTokenHashOptions = ReadPasswordRecoveryStateOptions & {
  expectedAppOrigin: string;
};

/**
 * Put an encrypted, short-lived state value in the email URL instead of a
 * Supabase bearer URL. Unlike URL fragments, a normal query value survives
 * email-link tracking. The token hash is only returned after the recipient
 * explicitly continues from the confirmation screen.
 */
export function createPasswordRecoveryStateConfirmationUrl({
  appOrigin,
  tokenHash,
  secret,
  now = Date.now(),
}: CreatePasswordRecoveryStateConfirmationUrlOptions): string {
  const confirmationUrl = new URL("/auth/reset/confirm", appOrigin);
  confirmationUrl.searchParams.set(
    "state",
    createPasswordRecoveryState({ appOrigin, tokenHash, secret, now }),
  );
  return confirmationUrl.toString();
}

export function createPasswordRecoveryState({
  appOrigin,
  tokenHash,
  secret,
  now = Date.now(),
}: CreatePasswordRecoveryStateOptions): string {
  const audience = new URL(appOrigin).origin;
  const payload: PasswordRecoveryStatePayload = {
    version: STATE_VERSION,
    purpose: PASSWORD_RECOVERY_STATE_PURPOSE,
    audience,
    expiresAt: Math.floor(now / 1000) + PASSWORD_RECOVERY_STATE_TTL_SECONDS,
    tokenHash,
  };
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(secret), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([Buffer.from([STATE_VERSION]), iv, authTag, ciphertext]).toString("base64url");
}

export function readPasswordRecoveryState({
  state,
  secret,
  now = Date.now(),
}: ReadPasswordRecoveryStateOptions): PasswordRecoveryStatePayload | null {
  if (!secret || !isEncodedState(state)) return null;

  try {
    const encrypted = Buffer.from(state, "base64url");
    // Node's decoder accepts non-canonical final base64url characters whose
    // unused padding bits differ. Require the exact canonical serialization so
    // a tampered URL cannot decode to the same authenticated ciphertext.
    if (encrypted.toString("base64url") !== state) return null;

    if (encrypted.length <= 1 + IV_BYTES + AUTH_TAG_BYTES || encrypted[0] !== STATE_VERSION) {
      return null;
    }

    const ivStart = 1;
    const tagStart = ivStart + IV_BYTES;
    const ciphertextStart = tagStart + AUTH_TAG_BYTES;
    const decipher = createDecipheriv(
      "aes-256-gcm",
      encryptionKey(secret),
      encrypted.subarray(ivStart, tagStart),
    );
    decipher.setAuthTag(encrypted.subarray(tagStart, ciphertextStart));
    const payload = JSON.parse(
      Buffer.concat([decipher.update(encrypted.subarray(ciphertextStart)), decipher.final()]).toString("utf8"),
    ) as Partial<PasswordRecoveryStatePayload>;

    if (
      payload.version !== STATE_VERSION ||
      payload.purpose !== PASSWORD_RECOVERY_STATE_PURPOSE ||
      typeof payload.audience !== "string" ||
      typeof payload.expiresAt !== "number" ||
      payload.expiresAt <= Math.floor(now / 1000) ||
      typeof payload.tokenHash !== "string" ||
      !isTokenHash(payload.tokenHash) ||
      new URL(payload.audience).origin !== payload.audience
    ) {
      return null;
    }

    return {
      version: STATE_VERSION,
      purpose: PASSWORD_RECOVERY_STATE_PURPOSE,
      audience: payload.audience,
      expiresAt: payload.expiresAt,
      tokenHash: payload.tokenHash,
    };
  } catch {
    return null;
  }
}

export function readPasswordRecoveryTokenHash({
  state,
  secret,
  expectedAppOrigin,
  now,
}: ReadPasswordRecoveryTokenHashOptions): string | null {
  const payload = readPasswordRecoveryState({ state, secret, now });
  if (!payload || !sameOrigin(payload.audience, expectedAppOrigin)) return null;

  return payload.tokenHash;
}

function encryptionKey(secret: string): Buffer {
  return Buffer.from(
    hkdfSync(
      "sha256",
      secret,
      Buffer.alloc(0),
      "upflow/password-recovery-state/v1",
      32,
    ),
  );
}

function isEncodedState(state: string): boolean {
  return state.length > 0 && state.length <= MAX_STATE_LENGTH && /^[A-Za-z0-9_-]+$/.test(state);
}

function isTokenHash(tokenHash: string): boolean {
  return tokenHash.length > 0 && tokenHash.length <= MAX_TOKEN_HASH_LENGTH && !/[\u0000-\u001F\u007F\s]/.test(tokenHash);
}

function sameOrigin(left: string, right: string): boolean {
  try {
    return new URL(left).origin === new URL(right).origin;
  } catch {
    return false;
  }
}
