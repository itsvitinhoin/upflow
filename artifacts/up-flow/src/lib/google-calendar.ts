import {
  createCipheriv,
  createDecipheriv,
  createHash,
  hkdfSync,
  randomBytes,
} from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// This module deliberately keeps all Google OAuth and Calendar API work on
// the server. In particular, access and refresh tokens must never be returned
// to a browser, logged, or included in a CalendarEvent response.

const GOOGLE_OAUTH_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_OAUTH_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const GOOGLE_CALENDAR_API_URL = "https://www.googleapis.com/calendar/v3";

const TOKEN_CIPHERTEXT_VERSION = 1;
const TOKEN_IV_BYTES = 12;
const TOKEN_AUTH_TAG_BYTES = 16;
const TOKEN_MAX_LENGTH = 32_768;
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const ACCESS_TOKEN_EXPIRY_SKEW_MS = 60 * 1000;
const DEFAULT_EVENT_DURATION_MS = 60 * 60 * 1000;
const MANUAL_SYNC_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;
const MANUAL_SYNC_LIMIT = 250;
const GOOGLE_REQUEST_TIMEOUT_MS = 10 * 1000;
const GOOGLE_SYNC_JOB_LOCK_MS = 2 * 60 * 1000;
const GOOGLE_SYNC_TRANSACTION_TIMEOUT_MS = 30 * 1000;
const GOOGLE_SYNC_TRANSACTION_MAX_WAIT_MS = 5 * 1000;
const GOOGLE_SYNC_RETRY_MAX_MS = 24 * 60 * 60 * 1000;
const GOOGLE_SYNC_JOB_BATCH_SIZE = 10;

export const GOOGLE_CALENDAR_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.events",
  // Required only to show a connected user the calendars they can write to.
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
] as const;

export type GoogleCalendarConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  tokenEncryptionKey: string;
};

type GoogleCalendarConnectionRecord = {
  id: string;
  workspace_id: string;
  user_id: string;
  google_subject: string | null;
  google_email: string | null;
  google_name: string | null;
  calendar_id: string;
  calendar_name: string | null;
  access_token_ciphertext: string | null;
  refresh_token_ciphertext: string | null;
  token_expires_at: Date | null;
  scope: string | null;
  sync_enabled: boolean;
  disconnected_at: Date | null;
  last_synced_at: Date | null;
  last_error: string | null;
};

type GoogleCalendarEventLinkRecord = {
  id: string;
  event_id: string;
  connection_id: string;
  google_calendar_id: string;
  google_event_id: string | null;
  google_event_etag: string | null;
  google_event_url: string | null;
};

type GoogleCalendarSyncJobRecord = {
  id: string;
  workspace_id: string;
  user_id: string;
  connection_id: string;
  event_id: string | null;
  operation: "upsert" | "delete";
  force: boolean;
  google_calendar_id: string | null;
  google_event_id: string | null;
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  attempt_count: number;
  next_attempt_at: Date;
  lease_token: string | null;
  locked_until: Date | null;
};

type GoogleCalendarEventRecord = {
  id: string;
  workspace_id: string;
  created_by: string;
  title: string;
  description: string | null;
  starts_at: Date;
  ends_at: Date | null;
  timezone: string | null;
  status: string;
  location: string | null;
  meeting_url: string | null;
  reminders: Array<{ minutes_before: number; enabled?: boolean }>;
};

type GoogleCalendarTransaction = Prisma.TransactionClient;
type GoogleCalendarDatabaseClient = GoogleCalendarTransaction | typeof prisma;

type GoogleTokenPayload = {
  accessToken: string;
  refreshToken: string | null;
  expiresInSeconds: number;
  scope: string | null;
};

type GoogleCalendarApiEvent = {
  id?: unknown;
  etag?: unknown;
  htmlLink?: unknown;
};

type GoogleCalendarApiList = {
  items?: unknown;
};

type GoogleCalendarApiCalendar = {
  id?: unknown;
  summary?: unknown;
  primary?: unknown;
  accessRole?: unknown;
};

export type GoogleCalendarConnectionSummary = {
  email?: string;
  calendar_id: string;
  calendar_name?: string;
  sync_enabled: boolean;
  last_synced_at?: Date;
  last_error?: string;
};

export type GoogleCalendarListItem = {
  id: string;
  name: string;
  primary: boolean;
  access_role: string;
};

export type GoogleCalendarEventPayload = {
  id: string;
  summary: string;
  // These fields are deliberately present, even when empty. Google Calendar
  // PATCH preserves omitted fields, so omitting them would leave deleted
  // notes or locations behind in an existing provider event.
  description: string;
  location: string;
  start: { dateTime: string; timeZone?: string };
  end: { dateTime: string; timeZone?: string };
  status?: "cancelled";
  reminders: {
    useDefault: boolean;
    overrides?: Array<{ method: "popup"; minutes: number }>;
  };
  extendedProperties: {
    private: {
      upflow_event_id: string;
      upflow_workspace_id: string;
      upflow_source: "calendar";
    };
  };
};

class GoogleCalendarProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "GoogleCalendarProviderError";
  }
}

function readEnv(name: keyof NodeJS.ProcessEnv) {
  return process.env[name]?.trim() || null;
}

/**
 * Returns null until the operator explicitly completes Google Cloud setup.
 * This lets the rest of the calendar keep working without an integration.
 */
export function getGoogleCalendarConfig(): GoogleCalendarConfig | null {
  const clientId = readEnv("GOOGLE_CALENDAR_CLIENT_ID");
  const clientSecret = readEnv("GOOGLE_CALENDAR_CLIENT_SECRET");
  const redirectUri = readEnv("GOOGLE_CALENDAR_REDIRECT_URI");
  const tokenEncryptionKey = readEnv("GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY");

  if (!clientId || !clientSecret || !redirectUri || !tokenEncryptionKey) return null;

  try {
    const parsedRedirectUri = new URL(redirectUri);
    const loopbackHost = ["localhost", "127.0.0.1", "[::1]"].includes(parsedRedirectUri.hostname);
    if (
      parsedRedirectUri.protocol !== "https:" &&
      !(parsedRedirectUri.protocol === "http:" && loopbackHost)
    ) {
      return null;
    }
  } catch {
    return null;
  }

  return { clientId, clientSecret, redirectUri, tokenEncryptionKey };
}

function googleFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  return fetch(input, { ...init, signal: AbortSignal.timeout(GOOGLE_REQUEST_TIMEOUT_MS) });
}

export function createGoogleCalendarOAuthState() {
  return randomBytes(32).toString("base64url");
}

export function hashGoogleCalendarOAuthState(state: string) {
  return createHash("sha256").update(state, "utf8").digest("base64url");
}

export function createGoogleCalendarPkceVerifier() {
  // 64 URL-safe characters is safely inside Google's RFC 7636 bounds.
  return randomBytes(48).toString("base64url");
}

export function createGoogleCalendarPkceChallenge(verifier: string) {
  return createHash("sha256").update(verifier, "ascii").digest("base64url");
}

function tokenEncryptionKey(keyMaterial: string): Buffer {
  return Buffer.from(
    hkdfSync(
      "sha256",
      keyMaterial,
      Buffer.alloc(0),
      "upflow/google-calendar-token/v1",
      32,
    ),
  );
}

/** Encrypt a provider secret at rest with AES-256-GCM. */
export function encryptGoogleCalendarSecret(value: string, keyMaterial: string) {
  if (!value || value.length > TOKEN_MAX_LENGTH) {
    throw new Error("Google Calendar secret has an invalid length");
  }

  const iv = randomBytes(TOKEN_IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", tokenEncryptionKey(keyMaterial), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([
    Buffer.from([TOKEN_CIPHERTEXT_VERSION]),
    iv,
    authTag,
    ciphertext,
  ]).toString("base64url");
}

/** Decrypt a locally-stored provider secret. Throws only a generic error. */
export function decryptGoogleCalendarSecret(ciphertext: string, keyMaterial: string) {
  if (
    !ciphertext ||
    ciphertext.length > TOKEN_MAX_LENGTH ||
    !/^[A-Za-z0-9_-]+$/.test(ciphertext)
  ) {
    throw new Error("Google Calendar secret could not be decrypted");
  }

  try {
    const encoded = Buffer.from(ciphertext, "base64url");
    if (encoded.toString("base64url") !== ciphertext) {
      throw new Error("non-canonical ciphertext");
    }

    const minimumLength = 1 + TOKEN_IV_BYTES + TOKEN_AUTH_TAG_BYTES + 1;
    if (encoded.length < minimumLength || encoded[0] !== TOKEN_CIPHERTEXT_VERSION) {
      throw new Error("unexpected ciphertext");
    }

    const ivStart = 1;
    const authTagStart = ivStart + TOKEN_IV_BYTES;
    const bodyStart = authTagStart + TOKEN_AUTH_TAG_BYTES;
    const decipher = createDecipheriv(
      "aes-256-gcm",
      tokenEncryptionKey(keyMaterial),
      encoded.subarray(ivStart, authTagStart),
    );
    decipher.setAuthTag(encoded.subarray(authTagStart, bodyStart));
    return Buffer.concat([
      decipher.update(encoded.subarray(bodyStart)),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error("Google Calendar secret could not be decrypted");
  }
}

export function getGoogleCalendarAuthorizationUrl(input: {
  config: GoogleCalendarConfig;
  state: string;
  codeChallenge: string;
}) {
  const url = new URL(GOOGLE_OAUTH_AUTHORIZE_URL);
  url.searchParams.set("client_id", input.config.clientId);
  url.searchParams.set("redirect_uri", input.config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_CALENDAR_SCOPES.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", input.state);
  url.searchParams.set("code_challenge", input.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function getFinitePositiveNumber(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

async function responseJson(response: Response): Promise<Record<string, unknown> | null> {
  const body: unknown = await response.json().catch(() => null);
  return isRecord(body) ? body : null;
}

function publicGoogleCalendarError(_: unknown) {
  // Do not surface provider response bodies or token errors to users. The
  // recovery action is the same for all failures: retry or reconnect.
  return "Google Calendar sync failed. Reconnect Google Calendar if this continues.";
}

function isGoogleNotFound(error: unknown) {
  return error instanceof GoogleCalendarProviderError && error.status === 404;
}

function isGoogleUnauthorized(error: unknown) {
  return error instanceof GoogleCalendarProviderError && error.status === 401;
}

function isGoogleConflict(error: unknown) {
  return error instanceof GoogleCalendarProviderError && error.status === 409;
}

async function exchangeGoogleAuthorizationCode(input: {
  config: GoogleCalendarConfig;
  code: string;
  codeVerifier: string;
}) {
  let response: Response;
  try {
    response = await googleFetch(GOOGLE_OAUTH_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: input.code,
        client_id: input.config.clientId,
        client_secret: input.config.clientSecret,
        redirect_uri: input.config.redirectUri,
        grant_type: "authorization_code",
        code_verifier: input.codeVerifier,
      }),
      cache: "no-store",
    });
  } catch {
    throw new GoogleCalendarProviderError("Google Calendar authorization could not be completed");
  }

  const body = await responseJson(response);
  if (!response.ok || !body) {
    throw new GoogleCalendarProviderError(
      "Google Calendar authorization could not be completed",
      response.status,
    );
  }

  return parseGoogleTokenPayload(body);
}

async function refreshGoogleAccessToken(
  connection: GoogleCalendarConnectionRecord,
  config: GoogleCalendarConfig,
  db: GoogleCalendarDatabaseClient = prisma,
) {
  if (!connection.refresh_token_ciphertext) {
    throw new GoogleCalendarProviderError("Google Calendar reconnection is required");
  }

  let refreshToken: string;
  try {
    refreshToken = decryptGoogleCalendarSecret(
      connection.refresh_token_ciphertext,
      config.tokenEncryptionKey,
    );
  } catch (error) {
    await markGoogleCalendarConnectionNeedsReconnect(connection.id, db).catch(() => undefined);
    throw error;
  }

  let response: Response;
  try {
    response = await googleFetch(GOOGLE_OAUTH_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
      cache: "no-store",
    });
  } catch {
    throw new GoogleCalendarProviderError("Google Calendar token refresh failed");
  }

  const body = await responseJson(response);
  if (!response.ok || !body) {
    if (response.status === 400) {
      await markGoogleCalendarConnectionNeedsReconnect(connection.id, db).catch(() => undefined);
    }
    throw new GoogleCalendarProviderError("Google Calendar token refresh failed", response.status);
  }

  const tokens = parseGoogleTokenPayload(body);
  const nextRefreshToken = tokens.refreshToken
    ? encryptGoogleCalendarSecret(tokens.refreshToken, config.tokenEncryptionKey)
    : connection.refresh_token_ciphertext;

  await db.googleCalendarConnection.update({
    where: { id: connection.id },
    data: {
      access_token_ciphertext: encryptGoogleCalendarSecret(
        tokens.accessToken,
        config.tokenEncryptionKey,
      ),
      refresh_token_ciphertext: nextRefreshToken,
      token_expires_at: tokenExpiresAt(tokens.expiresInSeconds),
      scope: tokens.scope ?? connection.scope,
      last_error: null,
    },
  });

  return tokens.accessToken;
}

function parseGoogleTokenPayload(body: Record<string, unknown>): GoogleTokenPayload {
  const accessToken = getString(body, "access_token");
  if (!accessToken) {
    throw new GoogleCalendarProviderError("Google Calendar token response was invalid");
  }

  return {
    accessToken,
    refreshToken: getString(body, "refresh_token"),
    expiresInSeconds: getFinitePositiveNumber(body, "expires_in") ?? 3600,
    scope: getString(body, "scope"),
  };
}

function tokenExpiresAt(expiresInSeconds: number) {
  return new Date(Date.now() + expiresInSeconds * 1000);
}

async function markGoogleCalendarConnectionNeedsReconnect(
  connectionId: string,
  db: GoogleCalendarDatabaseClient = prisma,
) {
  await db.googleCalendarConnection.update({
    where: { id: connectionId },
    data: {
      // Do not leave a known-invalid credential available to force-enabled
      // manual sync. Event links and deletion tombstones remain intact for a
      // safe same-account reconnect.
      access_token_ciphertext: null,
      refresh_token_ciphertext: null,
      token_expires_at: null,
      sync_enabled: false,
      disconnected_at: new Date(),
      last_error: "Google Calendar needs to be reconnected.",
    },
  });
}

async function getGoogleCalendarAccessToken(
  connection: GoogleCalendarConnectionRecord,
  config: GoogleCalendarConfig,
  forceRefresh = false,
  db: GoogleCalendarDatabaseClient = prisma,
) {
  const accessTokenCiphertext = connection.access_token_ciphertext;
  const tokenIsNearExpiry =
    connection.token_expires_at !== null &&
    connection.token_expires_at.getTime() <= Date.now() + ACCESS_TOKEN_EXPIRY_SKEW_MS;

  if (forceRefresh || !accessTokenCiphertext || tokenIsNearExpiry) {
    return refreshGoogleAccessToken(connection, config, db);
  }

  try {
    return decryptGoogleCalendarSecret(
      accessTokenCiphertext,
      config.tokenEncryptionKey,
    );
  } catch (error) {
    await markGoogleCalendarConnectionNeedsReconnect(connection.id, db).catch(() => undefined);
    throw error;
  }
}

async function requestGoogleCalendarApi<T>(input: {
  connection: GoogleCalendarConnectionRecord;
  config: GoogleCalendarConfig;
  path: string;
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  db?: GoogleCalendarDatabaseClient;
}) {
  const send = async (accessToken: string) => {
    let response: Response;
    try {
      response = await googleFetch(`${GOOGLE_CALENDAR_API_URL}${input.path}`, {
        method: input.method ?? "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...(input.body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: input.body === undefined ? undefined : JSON.stringify(input.body),
        cache: "no-store",
      });
    } catch {
      throw new GoogleCalendarProviderError("Google Calendar request failed");
    }

    if (response.status === 204) return null;

    const body = await responseJson(response);
    if (!response.ok) {
      throw new GoogleCalendarProviderError("Google Calendar request failed", response.status);
    }
    return body as T | null;
  };

  let accessToken = await getGoogleCalendarAccessToken(input.connection, input.config, false, input.db);
  try {
    return await send(accessToken);
  } catch (error) {
    if (!isGoogleUnauthorized(error)) throw error;
    accessToken = await getGoogleCalendarAccessToken(input.connection, input.config, true, input.db);
    return send(accessToken);
  }
}

async function fetchGoogleUserProfile(accessToken: string) {
  try {
    const response = await googleFetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    const body = await responseJson(response);
    if (!response.ok || !body) return null;
    return {
      subject: getString(body, "sub"),
      email: getString(body, "email"),
      name: getString(body, "name"),
    };
  } catch {
    // The connection is still valid if optional profile enrichment fails.
    return null;
  }
}

function isSafeOAuthState(state: string) {
  return state.length >= 32 && state.length <= 256 && /^[A-Za-z0-9_-]+$/.test(state);
}

function summaryForConnection(connection: GoogleCalendarConnectionRecord): GoogleCalendarConnectionSummary {
  return {
    ...(connection.google_email ? { email: connection.google_email } : {}),
    calendar_id: connection.calendar_id,
    ...(connection.calendar_name ? { calendar_name: connection.calendar_name } : {}),
    sync_enabled: connection.sync_enabled,
    ...(connection.last_synced_at ? { last_synced_at: connection.last_synced_at } : {}),
    ...(connection.last_error ? { last_error: connection.last_error } : {}),
  };
}

async function hasActiveWorkspaceMembership(
  workspaceId: string,
  userId: string,
  db: GoogleCalendarDatabaseClient = prisma,
) {
  const membership = await db.workspaceMember.findFirst({
    where: {
      workspace_id: workspaceId,
      user_id: userId,
      status: "active",
    },
    select: { id: true },
  });
  return Boolean(membership);
}

function isGoogleCalendarConnectionActive(connection: GoogleCalendarConnectionRecord | null) {
  return Boolean(
    connection &&
      connection.access_token_ciphertext &&
      connection.refresh_token_ciphertext &&
      !connection.disconnected_at,
  );
}

export async function getGoogleCalendarConnectionStatus(input: {
  workspaceId: string;
  userId: string;
}) {
  const connection = (await prisma.googleCalendarConnection.findUnique({
    where: {
      workspace_id_user_id: {
        workspace_id: input.workspaceId,
        user_id: input.userId,
      },
    },
  })) as GoogleCalendarConnectionRecord | null;

  const connected = isGoogleCalendarConnectionActive(connection);
  return {
    ready: Boolean(getGoogleCalendarConfig()),
    connected,
    // Keep a safe status summary available after a credential expires so the
    // UI can offer reconnect without confusing it with a deliberate
    // disconnect. Credential ciphertext is never included in this response.
    ...(connection ? { connection: summaryForConnection(connection) } : {}),
  };
}

export async function createGoogleCalendarConnectUrl(input: {
  workspaceId: string;
  userId: string;
}) {
  const config = getGoogleCalendarConfig();
  if (!config) return null;

  const state = createGoogleCalendarOAuthState();
  const codeVerifier = createGoogleCalendarPkceVerifier();
  const expiresAt = new Date(Date.now() + OAUTH_STATE_TTL_MS);

  await prisma.$transaction([
    prisma.googleCalendarOAuthState.deleteMany({
      where: { expires_at: { lt: new Date() } },
    }),
    prisma.googleCalendarOAuthState.create({
      data: {
        state_hash: hashGoogleCalendarOAuthState(state),
        code_verifier_ciphertext: encryptGoogleCalendarSecret(
          codeVerifier,
          config.tokenEncryptionKey,
        ),
        redirect_uri: config.redirectUri,
        workspace_id: input.workspaceId,
        user_id: input.userId,
        expires_at: expiresAt,
      },
    }),
  ]);

  return getGoogleCalendarAuthorizationUrl({
    config,
    state,
    codeChallenge: createGoogleCalendarPkceChallenge(codeVerifier),
  });
}

export function getGoogleCalendarResultUrl(
  config: GoogleCalendarConfig,
  result: "connected" | "error",
) {
  const callbackOrigin = new URL(config.redirectUri).origin;
  const url = new URL("/calendar", callbackOrigin);
  url.searchParams.set("google_calendar", result);
  return url;
}

export async function completeGoogleCalendarConnect(input: {
  state: string;
  code: string;
  userId: string;
}) {
  const config = getGoogleCalendarConfig();
  if (!config || !isSafeOAuthState(input.state) || !input.code || input.code.length > 8_192) {
    return { ok: false as const, config };
  }

  const stateHash = hashGoogleCalendarOAuthState(input.state);
  const oauthState = await prisma.googleCalendarOAuthState.findUnique({
    where: { state_hash: stateHash },
  });

  if (
    !oauthState ||
    oauthState.expires_at.getTime() <= Date.now() ||
    oauthState.user_id !== input.userId ||
    oauthState.redirect_uri !== config.redirectUri
  ) {
    return { ok: false as const, config };
  }

  // Consume the state before exchanging the authorization code. If two tabs
  // race, only the one that deletes this record first can continue.
  try {
    await prisma.googleCalendarOAuthState.delete({ where: { state_hash: stateHash } });
  } catch {
    return { ok: false as const, config };
  }

  let codeVerifier: string;
  try {
    codeVerifier = decryptGoogleCalendarSecret(
      oauthState.code_verifier_ciphertext,
      config.tokenEncryptionKey,
    );
  } catch {
    return { ok: false as const, config };
  }

  try {
    const tokens = await exchangeGoogleAuthorizationCode({
      config,
      code: input.code,
      codeVerifier,
    });

    // Every completed authorization must bind a newly issued durable token to
    // the Google account that completed this exact OAuth exchange. Reusing a
    // stored refresh token here could combine an access token for a newly
    // selected Google account with the refresh token of a previous one.
    const profile = await fetchGoogleUserProfile(tokens.accessToken);
    const googleSubject = profile?.subject;
    if (!tokens.refreshToken || !googleSubject) {
      return { ok: false as const, config };
    }

    const accessTokenCiphertext = encryptGoogleCalendarSecret(
      tokens.accessToken,
      config.tokenEncryptionKey,
    );
    const refreshTokenCiphertext = encryptGoogleCalendarSecret(
      tokens.refreshToken,
      config.tokenEncryptionKey,
    );

    // Lock the membership row while creating the connection. This prevents a
    // callback that began just before a member was removed from recreating an
    // OAuth grant after the membership-cleanup transaction has run.
    const saved = await prisma.$transaction(async (tx) => {
      const activeMemberships = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "WorkspaceMember"
        WHERE "workspace_id" = ${oauthState.workspace_id}
          AND "user_id" = ${input.userId}
          AND "status" = 'active'
        FOR UPDATE
      `;
      if (activeMemberships.length === 0) return { saved: false as const, replacedConnection: null };

      const existing = (await tx.googleCalendarConnection.findUnique({
        where: {
          workspace_id_user_id: {
            workspace_id: oauthState.workspace_id,
            user_id: input.userId,
          },
        },
      })) as GoogleCalendarConnectionRecord | null;

      // The sync worker and disconnect flow lock this row before provider
      // calls. Take the same lock before replacing a connection so a callback
      // for a different Google account cannot race an in-flight sync.
      if (existing && !(await lockGoogleCalendarConnectionForSync(tx, existing.id))) {
        return { saved: false as const, replacedConnection: null };
      }
      const lockedExisting = existing
        ? ((await tx.googleCalendarConnection.findUnique({
            where: { id: existing.id },
          })) as GoogleCalendarConnectionRecord | null)
        : null;

      // A user can deliberately choose a different Google account during a
      // reconnect. Remote event identifiers are account-specific, so retaining
      // links from a different Google subject could otherwise update the wrong
      // account or create duplicate events. Remove the old local relationship
      // first; it cascades its stale links and pending delivery jobs.
      const matchingExisting =
        lockedExisting && lockedExisting.google_subject === googleSubject ? lockedExisting : null;
      const replacedConnection = lockedExisting && !matchingExisting ? lockedExisting : null;
      if (replacedConnection) {
        await tx.googleCalendarConnection.delete({ where: { id: replacedConnection.id } });
      }

      const data = {
        google_subject: googleSubject,
        google_email: profile?.email ?? matchingExisting?.google_email ?? null,
        google_name: profile?.name ?? matchingExisting?.google_name ?? null,
        calendar_id: matchingExisting?.calendar_id ?? "primary",
        calendar_name: matchingExisting?.calendar_name ?? "Primary",
        access_token_ciphertext: accessTokenCiphertext,
        refresh_token_ciphertext: refreshTokenCiphertext,
        token_expires_at: tokenExpiresAt(tokens.expiresInSeconds),
        scope: tokens.scope ?? matchingExisting?.scope ?? GOOGLE_CALENDAR_SCOPES.join(" "),
        sync_enabled: true,
        disconnected_at: null,
        last_error: null,
      };

      const storedConnection = await tx.googleCalendarConnection.upsert({
        where: {
          workspace_id_user_id: {
            workspace_id: oauthState.workspace_id,
            user_id: input.userId,
          },
        },
        create: {
          workspace_id: oauthState.workspace_id,
          user_id: input.userId,
          ...data,
        },
        update: data,
      });
      // A deletion requested while intentionally disconnected is safe to keep
      // queued. Make it eligible immediately after a verified same-account
      // reconnect instead of waiting for the next maintenance pass.
      await tx.googleCalendarSyncJob.updateMany({
        where: {
          connection_id: storedConnection.id,
          operation: "delete",
          status: { in: ["pending", "failed"] },
        },
        data: {
          status: "pending",
          next_attempt_at: new Date(),
          locked_until: null,
          last_error: null,
          completed_at: null,
        },
      });
      return { saved: true as const, replacedConnection };
    });

    if (!saved.saved) {
      await revokeGoogleCalendarTokenValue(tokens.refreshToken, config);
      return { ok: false as const, config };
    }

    if (saved.replacedConnection && isGoogleCalendarConnectionActive(saved.replacedConnection)) {
      // The workspace now points at the newly verified Google account. Revoke
      // the replaced account's token after commit so a failed revoke cannot
      // roll back the safe local state.
      await revokeGoogleCalendarToken(saved.replacedConnection, config).catch(() => undefined);
    }

    return { ok: true as const, config };
  } catch {
    return { ok: false as const, config };
  }
}

async function findGoogleCalendarConnection(
  workspaceId: string,
  userId: string,
  db: GoogleCalendarDatabaseClient = prisma,
) {
  return (await db.googleCalendarConnection.findUnique({
    where: { workspace_id_user_id: { workspace_id: workspaceId, user_id: userId } },
  })) as GoogleCalendarConnectionRecord | null;
}

async function findActiveGoogleCalendarConnection(
  workspaceId: string,
  userId: string,
  db: GoogleCalendarDatabaseClient = prisma,
) {
  const connection = await findGoogleCalendarConnection(workspaceId, userId, db);
  return isGoogleCalendarConnectionActive(connection) ? connection : null;
}

export async function listGoogleCalendars(input: { workspaceId: string; userId: string }) {
  const config = getGoogleCalendarConfig();
  if (!config) throw new Error("Google Calendar integration is not configured");

  const connection = await findActiveGoogleCalendarConnection(input.workspaceId, input.userId);
  if (!connection) return [] as GoogleCalendarListItem[];

  const response = await requestGoogleCalendarApi<GoogleCalendarApiList>({
    connection,
    config,
    path: "/users/me/calendarList?minAccessRole=writer&maxResults=250",
  });

  const items = Array.isArray(response?.items) ? response.items : [];
  return items
    .flatMap((item): GoogleCalendarListItem[] => {
      if (!isRecord(item)) return [];
      const calendar = item as GoogleCalendarApiCalendar;
      const id = typeof calendar.id === "string" && calendar.id ? calendar.id : null;
      const accessRole =
        typeof calendar.accessRole === "string" && calendar.accessRole ? calendar.accessRole : null;
      if (!id || !accessRole || !["owner", "writer"].includes(accessRole)) return [];
      const primary = calendar.primary === true;
      return [
        {
          id,
          name: typeof calendar.summary === "string" && calendar.summary ? calendar.summary : id,
          primary,
          access_role: accessRole,
        },
      ];
    })
    .sort((left, right) => Number(right.primary) - Number(left.primary) || left.name.localeCompare(right.name));
}

export async function updateGoogleCalendarConnection(input: {
  workspaceId: string;
  userId: string;
  calendarId?: string;
  syncEnabled?: boolean;
}) {
  const connection = await findActiveGoogleCalendarConnection(input.workspaceId, input.userId);
  if (!connection) return null;

  let calendarName = connection.calendar_name;
  if (input.calendarId && input.calendarId !== connection.calendar_id) {
    if (input.calendarId === "primary") {
      calendarName = "Primary";
    } else {
      const calendars = await listGoogleCalendars(input);
      const calendar = calendars.find((item) => item.id === input.calendarId);
      if (!calendar) {
        throw new GoogleCalendarProviderError("Selected Google Calendar is not writable", 400);
      }
      calendarName = calendar.name;
    }
  }

  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    if (!(await lockGoogleCalendarConnectionForSync(tx, connection.id))) return null;
    const current = (await tx.googleCalendarConnection.findUnique({
      where: { id: connection.id },
    })) as GoogleCalendarConnectionRecord | null;
    if (!current || !isGoogleCalendarConnectionActive(current)) return null;

    const saved = await tx.googleCalendarConnection.update({
      where: { id: connection.id },
      data: {
        ...(input.calendarId ? { calendar_id: input.calendarId, calendar_name: calendarName } : {}),
        ...(typeof input.syncEnabled === "boolean" ? { sync_enabled: input.syncEnabled } : {}),
        ...(input.syncEnabled === true ? { last_error: null } : {}),
      },
    });
    if (input.syncEnabled === false) {
      await tx.googleCalendarSyncJob.updateMany({
        where: {
          connection_id: connection.id,
          operation: "upsert",
          status: { in: ["pending", "failed", "processing"] },
        },
        data: {
          status: "cancelled",
          lease_token: null,
          locked_until: null,
          last_error: null,
          completed_at: now,
        },
      });
    }
    return saved;
  }, {
    maxWait: GOOGLE_SYNC_TRANSACTION_MAX_WAIT_MS,
    timeout: GOOGLE_SYNC_TRANSACTION_TIMEOUT_MS,
  });

  return updated ? summaryForConnection(updated as GoogleCalendarConnectionRecord) : null;
}

async function revokeGoogleCalendarToken(
  connection: GoogleCalendarConnectionRecord,
  config: GoogleCalendarConfig,
) {
  const ciphertext = connection.refresh_token_ciphertext ?? connection.access_token_ciphertext;
  if (!ciphertext) return;
  const token = decryptGoogleCalendarSecret(ciphertext, config.tokenEncryptionKey);

  await revokeGoogleCalendarTokenValue(token, config);
}

async function revokeGoogleCalendarTokenValue(token: string, config: GoogleCalendarConfig) {
  await googleFetch(GOOGLE_OAUTH_REVOKE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
    cache: "no-store",
  }).catch(() => undefined);
}

export async function disconnectGoogleCalendar(input: { workspaceId: string; userId: string }) {
  const connection = await findGoogleCalendarConnection(input.workspaceId, input.userId);
  if (!connection) return false;

  const disconnectedConnection = await prisma.$transaction(async (tx) => {
    if (!(await lockGoogleCalendarConnectionForSync(tx, connection.id))) return null;
    const current = (await tx.googleCalendarConnection.findUnique({
      where: { id: connection.id },
    })) as GoogleCalendarConnectionRecord | null;
    if (!current) return null;

    await queueGoogleCalendarDisconnectTombstonesInTransaction(tx, current);
    await tx.googleCalendarConnection.update({
      where: { id: connection.id },
      data: {
        access_token_ciphertext: null,
        refresh_token_ciphertext: null,
        token_expires_at: null,
        scope: null,
        sync_enabled: false,
        disconnected_at: new Date(),
        last_error: null,
      },
    });
    // A user who disconnects has opted out of future UpFlow-to-Google writes.
    // Preserve deletion jobs: they carry a remote-event tombstone and may be
    // completed after a same-account reconnect.
    await tx.googleCalendarSyncJob.updateMany({
      where: {
        connection_id: connection.id,
        operation: "upsert",
        status: { in: ["pending", "failed", "processing"] },
      },
      data: {
        status: "cancelled",
        lease_token: null,
        locked_until: null,
        last_error: null,
        completed_at: new Date(),
      },
    });
    return current;
  }, {
    maxWait: GOOGLE_SYNC_TRANSACTION_MAX_WAIT_MS,
    timeout: GOOGLE_SYNC_TRANSACTION_TIMEOUT_MS,
  });
  if (!disconnectedConnection) return false;

  const config = getGoogleCalendarConfig();
  if (config && isGoogleCalendarConnectionActive(disconnectedConnection as GoogleCalendarConnectionRecord)) {
    // Revoke after the connection lock is released. Local credentials were
    // already removed transactionally, so an unavailable revocation endpoint
    // cannot re-enable the integration.
    await revokeGoogleCalendarToken(disconnectedConnection as GoogleCalendarConnectionRecord, config).catch(() => undefined);
  }
  return true;
}

function createGoogleCalendarProviderEventId(eventId: string) {
  // Google accepts lower-case base32hex event IDs. A SHA-256 hex digest is a
  // compatible subset and makes event creation idempotent across retries.
  return createHash("sha256").update(`upflow/google-calendar/${eventId}`, "utf8").digest("hex");
}

function createGoogleCalendarSyncLeaseToken() {
  return randomBytes(24).toString("base64url");
}

async function lockGoogleCalendarConnectionForSync(
  tx: GoogleCalendarTransaction,
  connectionId: string,
) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "GoogleCalendarConnection"
    WHERE "id" = ${connectionId}
    FOR UPDATE
  `;
  return rows.length > 0;
}

async function lockCalendarEventForGoogleSync(tx: GoogleCalendarTransaction, eventId: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "CalendarEvent"
    WHERE "id" = ${eventId}
    FOR UPDATE
  `;
  return rows.length > 0;
}

export function buildGoogleCalendarEventPayload(
  event: GoogleCalendarEventRecord,
): GoogleCalendarEventPayload {
  const endAt = event.ends_at ?? new Date(event.starts_at.getTime() + DEFAULT_EVENT_DURATION_MS);
  const timeZone = event.timezone?.trim() || undefined;
  const descriptionParts = [event.description?.trim(), event.meeting_url?.trim()]
    .filter((part): part is string => Boolean(part));
  const description = descriptionParts.join("\n\n");
  const location = event.location?.trim() ?? "";

  const reminderMinutes = Array.from(
    new Set(
      event.reminders
        .filter((reminder) => reminder.enabled !== false)
        .map((reminder) => reminder.minutes_before)
        .filter((minutes) => Number.isInteger(minutes) && minutes > 0 && minutes <= 40_320),
    ),
  )
    .sort((left, right) => left - right)
    .slice(0, 5);

  return {
    id: createGoogleCalendarProviderEventId(event.id),
    summary: event.title,
    description,
    location,
    start: { dateTime: event.starts_at.toISOString(), ...(timeZone ? { timeZone } : {}) },
    end: { dateTime: endAt.toISOString(), ...(timeZone ? { timeZone } : {}) },
    ...(event.status === "cancelled" ? { status: "cancelled" as const } : {}),
    reminders:
      reminderMinutes.length > 0
        ? {
            useDefault: false,
            overrides: reminderMinutes.map((minutes) => ({ method: "popup" as const, minutes })),
          }
        : { useDefault: true },
    extendedProperties: {
      private: {
        upflow_event_id: event.id,
        upflow_workspace_id: event.workspace_id,
        upflow_source: "calendar",
      },
    },
  };
}

function googleEventPath(calendarId: string, eventId?: string) {
  const calendar = encodeURIComponent(calendarId);
  return eventId
    ? `/calendars/${calendar}/events/${encodeURIComponent(eventId)}?sendUpdates=none`
    : `/calendars/${calendar}/events?sendUpdates=none`;
}

async function writeGoogleCalendarEventLink(input: {
  eventId: string;
  connectionId: string;
  calendarId: string;
  event: GoogleCalendarApiEvent;
  db?: GoogleCalendarDatabaseClient;
}) {
  const googleEventId = typeof input.event.id === "string" ? input.event.id : null;
  if (!googleEventId) throw new GoogleCalendarProviderError("Google Calendar event response was invalid");

  await (input.db ?? prisma).googleCalendarEventLink.upsert({
    where: {
      event_id_connection_id: {
        event_id: input.eventId,
        connection_id: input.connectionId,
      },
    },
    create: {
      event_id: input.eventId,
      connection_id: input.connectionId,
      google_calendar_id: input.calendarId,
      google_event_id: googleEventId,
      google_event_etag: typeof input.event.etag === "string" ? input.event.etag : null,
      google_event_url: typeof input.event.htmlLink === "string" ? input.event.htmlLink : null,
      sync_status: "synced",
      last_synced_at: new Date(),
      last_error: null,
    },
    update: {
      google_calendar_id: input.calendarId,
      google_event_id: googleEventId,
      google_event_etag: typeof input.event.etag === "string" ? input.event.etag : null,
      google_event_url: typeof input.event.htmlLink === "string" ? input.event.htmlLink : null,
      sync_status: "synced",
      last_synced_at: new Date(),
      last_error: null,
    },
  });
}

async function createOrReconcileGoogleCalendarEvent(input: {
  connection: GoogleCalendarConnectionRecord;
  config: GoogleCalendarConfig;
  calendarId: string;
  payload: GoogleCalendarEventPayload;
  db?: GoogleCalendarDatabaseClient;
}) {
  try {
    return await requestGoogleCalendarApi<GoogleCalendarApiEvent>({
      connection: input.connection,
      config: input.config,
      path: googleEventPath(input.calendarId),
      method: "POST",
      body: input.payload,
      db: input.db,
    });
  } catch (error) {
    if (!isGoogleConflict(error)) throw error;

    // A previous POST can reach Google but time out before UpFlow receives its
    // response. The deterministic provider ID lets us safely recover that
    // at-least-once delivery without creating a second event.
    return requestGoogleCalendarApi<GoogleCalendarApiEvent>({
      connection: input.connection,
      config: input.config,
      path: googleEventPath(input.calendarId, input.payload.id),
      method: "GET",
      db: input.db,
    });
  }
}

async function writeGoogleCalendarEventFailure(input: {
  eventId: string;
  connectionId: string;
  calendarId: string;
  db?: GoogleCalendarDatabaseClient;
}) {
  const db = input.db ?? prisma;
  await db.googleCalendarEventLink.upsert({
    where: {
      event_id_connection_id: {
        event_id: input.eventId,
        connection_id: input.connectionId,
      },
    },
    create: {
      event_id: input.eventId,
      connection_id: input.connectionId,
      google_calendar_id: input.calendarId,
      sync_status: "failed",
      last_error: publicGoogleCalendarError(null),
    },
    update: {
      sync_status: "failed",
      last_error: publicGoogleCalendarError(null),
    },
  });
  await db.googleCalendarConnection.update({
    where: { id: input.connectionId },
    data: { last_error: publicGoogleCalendarError(null) },
  });
}

export async function syncGoogleCalendarEvent(
  eventId: string,
  options: { force?: boolean; db?: GoogleCalendarDatabaseClient } = {},
) {
  const db = options.db ?? prisma;
  const config = getGoogleCalendarConfig();
  if (!config) return { status: "skipped" as const };

  const event = (await db.calendarEvent.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      workspace_id: true,
      created_by: true,
      title: true,
      description: true,
      starts_at: true,
      ends_at: true,
      timezone: true,
      status: true,
      location: true,
      meeting_url: true,
      reminders: { select: { minutes_before: true, enabled: true } },
    },
  })) as GoogleCalendarEventRecord | null;
  if (!event) return { status: "skipped" as const };

  // Calendar events can outlive a workspace membership. Never use a stored
  // OAuth connection for a former or inactive workspace member.
  if (!(await hasActiveWorkspaceMembership(event.workspace_id, event.created_by, db))) {
    return { status: "skipped" as const };
  }

  const connection = await findActiveGoogleCalendarConnection(event.workspace_id, event.created_by, db);
  if (!connection || (!connection.sync_enabled && !options.force)) {
    return { status: "skipped" as const };
  }

  const link = (await db.googleCalendarEventLink.findUnique({
    where: { event_id_connection_id: { event_id: event.id, connection_id: connection.id } },
  })) as GoogleCalendarEventLinkRecord | null;

  // A cancellation should never create a new Google event just to cancel it.
  if (event.status === "cancelled" && !link?.google_event_id) {
    return { status: "skipped" as const };
  }

  try {
    const payload = buildGoogleCalendarEventPayload(event);
    let remoteEvent: GoogleCalendarApiEvent | null;

    if (link?.google_event_id && link.google_calendar_id === connection.calendar_id) {
      try {
        remoteEvent = await requestGoogleCalendarApi<GoogleCalendarApiEvent>({
          connection,
          config,
          path: googleEventPath(link.google_calendar_id, link.google_event_id),
          method: "PATCH",
          body: payload,
          db,
        });
      } catch (error) {
        if (!isGoogleNotFound(error)) throw error;
        remoteEvent = await createOrReconcileGoogleCalendarEvent({
          connection,
          config,
          calendarId: connection.calendar_id,
          payload,
          db,
        });
      }
    } else if (link?.google_event_id && event.status === "cancelled") {
      remoteEvent = await requestGoogleCalendarApi<GoogleCalendarApiEvent>({
        connection,
        config,
        path: googleEventPath(link.google_calendar_id, link.google_event_id),
        method: "PATCH",
        body: { status: "cancelled" },
        db,
      });
    } else {
      if (link?.google_event_id) {
        try {
          await requestGoogleCalendarApi({
            connection,
            config,
            path: googleEventPath(link.google_calendar_id, link.google_event_id),
            method: "DELETE",
            db,
          });
        } catch (error) {
          if (!isGoogleNotFound(error)) throw error;
        }
      }
      remoteEvent = await createOrReconcileGoogleCalendarEvent({
        connection,
        config,
        calendarId: connection.calendar_id,
        payload,
        db,
      });
    }

    if (!remoteEvent) throw new GoogleCalendarProviderError("Google Calendar event response was empty");
    await writeGoogleCalendarEventLink({
      eventId: event.id,
      connectionId: connection.id,
      calendarId: event.status === "cancelled" && link ? link.google_calendar_id : connection.calendar_id,
      event: remoteEvent,
      db,
    });
    await db.googleCalendarConnection.update({
      where: { id: connection.id },
      data: { last_synced_at: new Date(), last_error: null },
    });
    return { status: "synced" as const };
  } catch (error) {
    // A Google outage must never block UpFlow's own local calendar mutations.
    await writeGoogleCalendarEventFailure({
      eventId: event.id,
      connectionId: connection.id,
      calendarId: link?.google_calendar_id ?? connection.calendar_id,
      db,
    }).catch(() => undefined);
    return { status: "failed" as const };
  }
}

/**
 * Persist an automatic event write before asking Google to do any work. The
 * unique key collapses rapid edits into the newest desired event state.
 */
export async function queueGoogleCalendarEventSync(
  eventId: string,
  options: { force?: boolean } = {},
) {
  return prisma.$transaction(
    (tx) => queueGoogleCalendarEventSyncInTransaction(tx, eventId, options),
    {
      maxWait: GOOGLE_SYNC_TRANSACTION_MAX_WAIT_MS,
      timeout: GOOGLE_SYNC_TRANSACTION_TIMEOUT_MS,
    },
  );
}

/**
 * Transaction-aware counterpart to `queueGoogleCalendarEventSync`.
 *
 * Calendar creates, edits, and duplications call this before their own
 * transaction commits. That makes a committed UpFlow mutation and its durable
 * outbox row inseparable: a process crash cannot permanently lose automatic
 * Google delivery between two separate database writes.
 */
export async function queueGoogleCalendarEventSyncInTransaction(
  tx: GoogleCalendarTransaction,
  eventId: string,
  options: { force?: boolean } = {},
) {
  if (!getGoogleCalendarConfig()) return null;

  const initialEvent = await tx.calendarEvent.findUnique({
    where: { id: eventId },
    select: { id: true, workspace_id: true, created_by: true },
  });
  if (!initialEvent) return null;

  const initialConnection = await findActiveGoogleCalendarConnection(
    initialEvent.workspace_id,
    initialEvent.created_by,
    tx,
  );
  if (!initialConnection) return null;

  // Every writer uses the same connection -> event ordering as the worker and
  // deletion tombstone path. That prevents a newly queued upsert from
  // slipping in after a local event has been deleted.
  if (!(await lockGoogleCalendarConnectionForSync(tx, initialConnection.id))) return null;
  if (!(await lockCalendarEventForGoogleSync(tx, eventId))) return null;

  const event = await tx.calendarEvent.findUnique({
      where: { id: eventId },
      select: { id: true, workspace_id: true, created_by: true },
  });
  if (!event || !(await hasActiveWorkspaceMembership(event.workspace_id, event.created_by, tx))) {
    return null;
  }

  const connection = (await tx.googleCalendarConnection.findUnique({
    where: { id: initialConnection.id },
  })) as GoogleCalendarConnectionRecord | null;
  if (!connection || (!connection.sync_enabled && !options.force)) return null;

  if (!isGoogleCalendarConnectionActive(connection)) return null;
  const link = (await tx.googleCalendarEventLink.findUnique({
    where: { event_id_connection_id: { event_id: event.id, connection_id: connection.id } },
  })) as GoogleCalendarEventLinkRecord | null;
  const googleEventId = link?.google_event_id ?? createGoogleCalendarProviderEventId(event.id);

  const job = await tx.googleCalendarSyncJob.upsert({
    where: {
      event_id_connection_id_operation: {
        event_id: event.id,
        connection_id: connection.id,
        operation: "upsert",
      },
    },
    create: {
      workspace_id: event.workspace_id,
      user_id: event.created_by,
      connection_id: connection.id,
      event_id: event.id,
      operation: "upsert",
      force: Boolean(options.force),
      google_calendar_id: connection.calendar_id,
      google_event_id: googleEventId,
      status: "pending",
      next_attempt_at: new Date(),
    },
    update: {
      google_calendar_id: connection.calendar_id,
      // Keep an immutable remote target while this job is in flight. A
      // delete tombstone can use it even if Google creates the event just
      // before the local record is removed.
      google_event_id: googleEventId,
      force: Boolean(options.force),
      status: "pending",
      attempt_count: 0,
      next_attempt_at: new Date(),
      lease_token: null,
      locked_until: null,
      last_error: null,
      completed_at: null,
    },
    select: { id: true },
  });

  return job.id;
}

type GoogleCalendarDeletionTarget = {
  connection: GoogleCalendarConnectionRecord;
  calendarId: string;
  googleEventId: string;
};

/**
 * Persist remote-event tombstones while the local event still exists. All
 * writers acquire connection rows first and the CalendarEvent row second, so
 * a provider upsert cannot run between this snapshot and local deletion.
 */
export async function queueGoogleCalendarEventDeletionInTransaction(
  tx: GoogleCalendarTransaction,
  eventId: string,
) {
  const initialEvent = await tx.calendarEvent.findUnique({
    where: { id: eventId },
    select: { id: true, workspace_id: true, created_by: true },
  });
  if (!initialEvent) return [] as string[];

  const [initialLinks, initialUpserts, currentConnection] = await Promise.all([
    tx.googleCalendarEventLink.findMany({
      where: { event_id: eventId },
      select: { connection_id: true },
    }),
    tx.googleCalendarSyncJob.findMany({
      where: {
        event_id: eventId,
        operation: "upsert",
        status: { in: ["pending", "failed", "processing"] },
      },
      select: { connection_id: true },
    }),
    tx.googleCalendarConnection.findUnique({
      where: {
        workspace_id_user_id: {
          workspace_id: initialEvent.workspace_id,
          user_id: initialEvent.created_by,
        },
      },
      select: { id: true },
    }),
  ]);
  const connectionIds = Array.from(
    new Set([
      ...initialLinks.map((link) => link.connection_id),
      ...initialUpserts.map((job) => job.connection_id),
      ...(currentConnection ? [currentConnection.id] : []),
    ]),
  ).sort();
  for (const connectionId of connectionIds) {
    await lockGoogleCalendarConnectionForSync(tx, connectionId);
  }
  if (!(await lockCalendarEventForGoogleSync(tx, eventId))) return [] as string[];

  const event = await tx.calendarEvent.findUnique({
    where: { id: eventId },
    select: { id: true, workspace_id: true, created_by: true },
  });
  if (!event) return [] as string[];

  const [connections, links, upserts] = await Promise.all([
    tx.googleCalendarConnection.findMany({
      where: { id: { in: connectionIds } },
    }),
    tx.googleCalendarEventLink.findMany({
      where: { event_id: eventId },
    }),
    tx.googleCalendarSyncJob.findMany({
      where: {
        event_id: eventId,
        operation: "upsert",
        status: { in: ["pending", "failed", "processing"] },
      },
    }),
  ]);
  const connectionById = new Map(
    connections.map((connection) => [connection.id, connection as GoogleCalendarConnectionRecord]),
  );
  const deletionTargets = new Map<string, GoogleCalendarDeletionTarget>();
  const addTarget = (connectionId: string, calendarId: string | null, googleEventId: string | null) => {
    const connection = connectionById.get(connectionId);
    if (!connection || !calendarId || !googleEventId || deletionTargets.has(connectionId)) return;
    deletionTargets.set(connectionId, { connection, calendarId, googleEventId });
  };

  // Prefer the provider's confirmed event ID. Snapshot targets on queued or
  // leased upserts cover a create that reached Google just before this delete.
  for (const link of links) {
    addTarget(link.connection_id, link.google_calendar_id, link.google_event_id);
  }
  for (const upsert of upserts) {
    addTarget(
      upsert.connection_id,
      upsert.google_calendar_id,
      upsert.google_event_id ?? createGoogleCalendarProviderEventId(event.id),
    );
  }
  const ownerConnection = connections.find(
    (connection) =>
      connection.workspace_id === event.workspace_id && connection.user_id === event.created_by,
  ) as GoogleCalendarConnectionRecord | undefined;
  if (ownerConnection) {
    addTarget(
      ownerConnection.id,
      ownerConnection.calendar_id,
      createGoogleCalendarProviderEventId(event.id),
    );
  }

  const now = new Date();
  await tx.googleCalendarSyncJob.updateMany({
    where: {
      event_id: event.id,
      operation: "upsert",
      status: { in: ["pending", "failed", "processing"] },
    },
    data: {
      status: "cancelled",
      lease_token: null,
      locked_until: null,
      last_error: null,
      completed_at: now,
    },
  });

  const queued: string[] = [];
  for (const target of deletionTargets.values()) {
    const job = await tx.googleCalendarSyncJob.upsert({
      where: {
        event_id_connection_id_operation: {
          event_id: event.id,
          connection_id: target.connection.id,
          operation: "delete",
        },
      },
      create: {
        workspace_id: target.connection.workspace_id,
        user_id: target.connection.user_id,
        connection_id: target.connection.id,
        event_id: event.id,
        operation: "delete",
        google_calendar_id: target.calendarId,
        google_event_id: target.googleEventId,
        status: "pending",
        next_attempt_at: now,
      },
      update: {
        google_calendar_id: target.calendarId,
        google_event_id: target.googleEventId,
        status: "pending",
        attempt_count: 0,
        next_attempt_at: now,
        lease_token: null,
        locked_until: null,
        last_error: null,
        completed_at: null,
      },
      select: { id: true },
    });
    queued.push(job.id);
  }
  return queued;
}

export async function queueGoogleCalendarEventDeletion(eventId: string) {
  return prisma.$transaction(
    (tx) => queueGoogleCalendarEventDeletionInTransaction(tx, eventId),
    { maxWait: GOOGLE_SYNC_TRANSACTION_MAX_WAIT_MS, timeout: GOOGLE_SYNC_TRANSACTION_TIMEOUT_MS },
  );
}

export async function deleteCalendarEventWithGoogleTombstones(eventId: string) {
  return prisma.$transaction(async (tx) => {
    const jobIds = await queueGoogleCalendarEventDeletionInTransaction(tx, eventId);

    // `event_id` is intentionally required for upsert jobs by the database
    // payload constraint. Deleting the CalendarEvent would otherwise make the
    // foreign key set those jobs to NULL and abort this transaction. Delete
    // every obsolete upsert (including completed/cancelled jobs) only after
    // the delete tombstones above have been persisted. Delete jobs retain their
    // remote target and are allowed to outlive the local event.
    await tx.googleCalendarSyncJob.deleteMany({
      where: {
        event_id: eventId,
        operation: "upsert",
      },
    });
    await tx.calendarEvent.delete({ where: { id: eventId } });
    return jobIds;
  }, {
    maxWait: GOOGLE_SYNC_TRANSACTION_MAX_WAIT_MS,
    timeout: GOOGLE_SYNC_TRANSACTION_TIMEOUT_MS,
  });
}

/**
 * A disconnect deliberately retains already-linked Google events, but a
 * previously leased create may have reached Google before it could write its
 * local link. Preserve a tombstone for those snapshot targets so a verified
 * reconnect can clean them without exposing a new sync path.
 */
async function queueGoogleCalendarDisconnectTombstonesInTransaction(
  tx: GoogleCalendarTransaction,
  connection: GoogleCalendarConnectionRecord,
) {
  const [links, upserts] = await Promise.all([
    tx.googleCalendarEventLink.findMany({
      where: { connection_id: connection.id, google_event_id: { not: null } },
      select: { event_id: true },
    }),
    tx.googleCalendarSyncJob.findMany({
      where: {
        connection_id: connection.id,
        operation: "upsert",
        status: { in: ["pending", "failed", "processing"] },
      },
      select: { event_id: true, google_calendar_id: true, google_event_id: true },
    }),
  ]);
  const linkedEventIds = new Set(links.map((link) => link.event_id));
  const now = new Date();

  for (const upsert of upserts) {
    if (!upsert.event_id || linkedEventIds.has(upsert.event_id)) continue;
    const calendarId = upsert.google_calendar_id ?? connection.calendar_id;
    const googleEventId = upsert.google_event_id ?? createGoogleCalendarProviderEventId(upsert.event_id);
    await tx.googleCalendarSyncJob.upsert({
      where: {
        event_id_connection_id_operation: {
          event_id: upsert.event_id,
          connection_id: connection.id,
          operation: "delete",
        },
      },
      create: {
        workspace_id: connection.workspace_id,
        user_id: connection.user_id,
        connection_id: connection.id,
        event_id: upsert.event_id,
        operation: "delete",
        google_calendar_id: calendarId,
        google_event_id: googleEventId,
        status: "pending",
        next_attempt_at: now,
      },
      update: {
        google_calendar_id: calendarId,
        google_event_id: googleEventId,
        status: "pending",
        attempt_count: 0,
        next_attempt_at: now,
        lease_token: null,
        locked_until: null,
        last_error: null,
        completed_at: null,
      },
    });
  }
}

type GoogleCalendarSyncJobResult =
  | "completed"
  | "failed"
  | "cancelled"
  | "deferred"
  | "skipped";

function nextGoogleCalendarSyncRetry(attemptCount: number, now: Date) {
  const retryMs = Math.min(
    60_000 * 2 ** Math.min(Math.max(attemptCount - 1, 0), 10),
    GOOGLE_SYNC_RETRY_MAX_MS,
  );
  return new Date(now.getTime() + retryMs);
}

async function finalizeGoogleCalendarSyncJob(input: {
  id: string;
  leaseToken: string;
  lockUntil: Date;
  status: "completed" | "failed" | "cancelled" | "pending";
  nextAttemptAt?: Date;
  lastError?: string | null;
  completedAt?: Date | null;
  db?: GoogleCalendarDatabaseClient;
}) {
  return (input.db ?? prisma).googleCalendarSyncJob.updateMany({
    // Keep a newly queued edit pending if it arrived while an older leased job
    // was in flight. This makes rapid edits converge on the newest event data.
    where: {
      id: input.id,
      status: "processing",
      locked_until: input.lockUntil,
      lease_token: input.leaseToken,
    },
    data: {
      status: input.status,
      lease_token: null,
      locked_until: null,
      ...(input.nextAttemptAt ? { next_attempt_at: input.nextAttemptAt } : {}),
      ...(input.lastError !== undefined ? { last_error: input.lastError } : {}),
      ...(input.completedAt !== undefined ? { completed_at: input.completedAt } : {}),
    },
  });
}

export async function processGoogleCalendarSyncJob(
  jobId: string,
  options: { now?: Date } = {},
): Promise<GoogleCalendarSyncJobResult> {
  const now = options.now ?? new Date();
  const lockUntil = new Date(now.getTime() + GOOGLE_SYNC_JOB_LOCK_MS);
  const leaseToken = createGoogleCalendarSyncLeaseToken();
  const claimed = await prisma.googleCalendarSyncJob.updateMany({
    where: {
      id: jobId,
      OR: [
        {
          status: { in: ["pending", "failed"] },
          next_attempt_at: { lte: now },
        },
        {
          status: "processing",
          OR: [{ locked_until: null }, { locked_until: { lt: now } }],
        },
      ],
    },
    data: {
      status: "processing",
      attempt_count: { increment: 1 },
      lease_token: leaseToken,
      locked_until: lockUntil,
      last_error: null,
    },
  });
  if (claimed.count === 0) return "skipped";

  const claimedJob = await prisma.googleCalendarSyncJob.findUnique({
    where: { id: jobId },
    select: { connection_id: true },
  });
  if (!claimedJob) return "cancelled";

  try {
    return await prisma.$transaction(async (tx) => {
      if (!(await lockGoogleCalendarConnectionForSync(tx, claimedJob.connection_id))) {
        return "cancelled" as const;
      }
      const job = (await tx.googleCalendarSyncJob.findUnique({
        where: { id: jobId },
        include: { connection: true },
      })) as (GoogleCalendarSyncJobRecord & { connection: GoogleCalendarConnectionRecord }) | null;
      if (!job || job.status !== "processing" || job.lease_token !== leaseToken) {
        return "cancelled" as const;
      }

      const complete = async () => {
        if (job.operation === "delete" && job.event_id) {
          // A cancellation retains the local event, but its Google link must
          // not later cause a manual sync to recreate it.
          await tx.googleCalendarEventLink.deleteMany({
            where: {
              event_id: job.event_id,
              connection_id: job.connection_id,
              event: { status: "cancelled" },
            },
          });
        }
        await finalizeGoogleCalendarSyncJob({
          id: job.id,
          leaseToken,
          lockUntil,
          status: "completed",
          lastError: null,
          completedAt: new Date(),
          db: tx,
        });
        return "completed" as const;
      };
      const cancel = async () => {
        await finalizeGoogleCalendarSyncJob({
          id: job.id,
          leaseToken,
          lockUntil,
          status: "cancelled",
          lastError: null,
          completedAt: new Date(),
          db: tx,
        });
        return "cancelled" as const;
      };
      const defer = async () => {
        await finalizeGoogleCalendarSyncJob({
          id: job.id,
          leaseToken,
          lockUntil,
          status: "pending",
          nextAttemptAt: new Date(now.getTime() + 60 * 60 * 1000),
          lastError: null,
          completedAt: null,
          db: tx,
        });
        return "deferred" as const;
      };
      const fail = async () => {
        const message = publicGoogleCalendarError(null);
        const updated = await finalizeGoogleCalendarSyncJob({
          id: job.id,
          leaseToken,
          lockUntil,
          status: "failed",
          nextAttemptAt: nextGoogleCalendarSyncRetry(job.attempt_count, now),
          lastError: message,
          completedAt: null,
          db: tx,
        });
        if (updated.count > 0) {
          await tx.googleCalendarConnection.update({
            where: { id: job.connection_id },
            data: { last_error: message },
          });
        }
        return "failed" as const;
      };

      if (!(await hasActiveWorkspaceMembership(job.workspace_id, job.user_id, tx))) {
        // Deletion tombstones are harmless to retain and must remain available
        // for a same-account reconnect. Upserts, however, should not execute
        // for a former member.
        return job.operation === "delete" ? defer() : cancel();
      }

      const config = getGoogleCalendarConfig();
      if (!config || !isGoogleCalendarConnectionActive(job.connection)) {
        return defer();
      }

      if (job.operation === "upsert") {
        if (!job.event_id || !(await lockCalendarEventForGoogleSync(tx, job.event_id))) {
          return cancel();
        }
        const result = await syncGoogleCalendarEvent(job.event_id, { force: job.force, db: tx });
        if (result.status === "synced") return complete();
        if (result.status === "failed") return fail();
        return cancel();
      }

      if (!job.google_calendar_id || !job.google_event_id) return cancel();
      try {
        await requestGoogleCalendarApi({
          connection: job.connection,
          config,
          path: googleEventPath(job.google_calendar_id, job.google_event_id),
          method: "DELETE",
          db: tx,
        });
        return complete();
      } catch (error) {
        if (isGoogleNotFound(error)) return complete();
        return fail();
      }
    }, {
      maxWait: GOOGLE_SYNC_TRANSACTION_MAX_WAIT_MS,
      timeout: GOOGLE_SYNC_TRANSACTION_TIMEOUT_MS,
    });
  } catch {
    const job = await prisma.googleCalendarSyncJob.findUnique({
      where: { id: jobId },
      select: { attempt_count: true, connection_id: true },
    });
    if (!job) return "cancelled";
    const message = publicGoogleCalendarError(null);
    const updated = await finalizeGoogleCalendarSyncJob({
      id: jobId,
      leaseToken,
      lockUntil,
      status: "failed",
      nextAttemptAt: nextGoogleCalendarSyncRetry(job.attempt_count, now),
      lastError: message,
      completedAt: null,
    });
    if (updated.count > 0) {
      await prisma.googleCalendarConnection.update({
        where: { id: job.connection_id },
        data: { last_error: message },
      }).catch(() => undefined);
      return "failed";
    }
    return "skipped";
  }
}

export async function processPendingGoogleCalendarSyncJobs(input: {
  workspaceId?: string;
  userId?: string;
  now?: Date;
  limit?: number;
} = {}) {
  const now = input.now ?? new Date();
  const jobs = await prisma.googleCalendarSyncJob.findMany({
    where: {
      ...(input.workspaceId ? { workspace_id: input.workspaceId } : {}),
      ...(input.userId ? { user_id: input.userId } : {}),
      OR: [
        { status: { in: ["pending", "failed"] }, next_attempt_at: { lte: now } },
        { status: "processing", OR: [{ locked_until: null }, { locked_until: { lt: now } }] },
      ],
    },
    orderBy: { next_attempt_at: "asc" },
    take: Math.max(1, Math.min(input.limit ?? GOOGLE_SYNC_JOB_BATCH_SIZE, GOOGLE_SYNC_JOB_BATCH_SIZE)),
    select: { id: true },
  });

  const outcomes: Record<GoogleCalendarSyncJobResult, number> = {
    completed: 0,
    failed: 0,
    cancelled: 0,
    deferred: 0,
    skipped: 0,
  };
  // Keep provider concurrency deliberately low; the durable queue covers the
  // remainder on the next immediate or scheduled pass.
  for (let index = 0; index < jobs.length; index += 3) {
    const results = await Promise.all(
      jobs.slice(index, index + 3).map((job) => processGoogleCalendarSyncJob(job.id, { now })),
    );
    for (const result of results) outcomes[result] += 1;
  }

  return { processed: jobs.length, ...outcomes };
}

export async function syncUpcomingGoogleCalendarEvents(input: {
  workspaceId: string;
  userId: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  await processPendingGoogleCalendarSyncJobs({
    workspaceId: input.workspaceId,
    userId: input.userId,
    now,
  });

  const events = await prisma.calendarEvent.findMany({
    where: {
      workspace_id: input.workspaceId,
      created_by: input.userId,
      starts_at: { gte: new Date(now.getTime() - MANUAL_SYNC_LOOKBACK_MS) },
    },
    orderBy: { starts_at: "asc" },
    take: MANUAL_SYNC_LIMIT,
    select: { id: true },
  });

  let synced = 0;
  let failed = 0;
  let skipped = 0;
  // Small batches keep a manual sync responsive without sending an unbounded
  // burst of requests to Google's Calendar API.
  for (let index = 0; index < events.length; index += 5) {
    const results = await Promise.all(
      events.slice(index, index + 5).map(async (event) => {
        try {
          // A user-requested manual sync deserves the same durable retry path
          // as automatic updates. `force` intentionally honors this one
          // explicit action even when automatic sync is currently paused.
          const jobId = await queueGoogleCalendarEventSync(event.id, { force: true });
          return jobId ? processGoogleCalendarSyncJob(jobId) : ("skipped" as const);
        } catch {
          return "failed" as const;
        }
      }),
    );
    for (const result of results) {
      if (result === "completed") synced += 1;
      else if (result === "failed") failed += 1;
      else skipped += 1;
    }
  }

  // Manual sync has completed even when there were no eligible events.
  const connection = await findActiveGoogleCalendarConnection(input.workspaceId, input.userId);
  if (connection) {
    await prisma.googleCalendarConnection.update({
      where: { id: connection.id },
      data: { last_synced_at: new Date(), last_error: failed > 0 ? connection.last_error : null },
    });
  }

  return { synced, failed, skipped };
}
