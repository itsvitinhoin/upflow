import { timingSafeEqual } from "node:crypto";

type ErrorRecord = {
  cause?: unknown;
  code?: unknown;
  errorCode?: unknown;
  message?: unknown;
  name?: unknown;
};

export type DatabaseErrorKind =
  | "authentication"
  | "connection_pool"
  | "invalid_connection_string"
  | "prisma_initialization"
  | "prisma_request"
  | "prisma_validation"
  | "timeout"
  | "unreachable"
  | "unknown";

function asErrorRecord(error: unknown): ErrorRecord | undefined {
  return typeof error === "object" && error !== null
    ? (error as ErrorRecord)
    : undefined;
}

function databaseErrorStrings(error: unknown): string[] {
  const candidate = asErrorRecord(error);
  const cause = asErrorRecord(candidate?.cause);
  return [
    candidate?.code,
    candidate?.errorCode,
    candidate?.name,
    candidate?.message,
    cause?.code,
    cause?.errorCode,
    cause?.name,
    cause?.message,
  ].filter((value): value is string => typeof value === "string");
}

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
  for (const value of databaseErrorStrings(error)) {
    const code = value.match(/\b(P\d{4})\b/)?.[1];
    if (code) return code;
  }

  return "UNKNOWN";
}

export function databaseErrorKind(error: unknown): DatabaseErrorKind {
  const code = databaseErrorCode(error);
  const byCode: Partial<Record<string, DatabaseErrorKind>> = {
    P1000: "authentication",
    P1001: "unreachable",
    P1002: "timeout",
    P1008: "timeout",
    P1013: "invalid_connection_string",
    P2024: "connection_pool",
  };
  if (byCode[code]) return byCode[code];

  const details = databaseErrorStrings(error).join(" ").toLowerCase();
  if (/authentication failed|password authentication/.test(details)) {
    return "authentication";
  }
  if (/invalid database string|invalid connection string|connection string/.test(details)) {
    return "invalid_connection_string";
  }
  if (/can't reach database server|econnrefused|enotfound|eai_again|ehostunreach|enetunreach/.test(details)) {
    return "unreachable";
  }
  if (/timed out|timeout/.test(details)) return "timeout";
  if (/prismaclientinitializationerror/.test(details)) {
    return "prisma_initialization";
  }
  if (/prismaclientvalidationerror/.test(details)) return "prisma_validation";
  if (/prismaclientknownrequesterror/.test(details)) return "prisma_request";

  return "unknown";
}
