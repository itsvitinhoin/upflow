import type { NextRequest } from "next/server";

export interface PaginationOpts {
  /** Default page size when no `limit` query param is supplied. */
  defaultLimit: number;
  /** Hard cap on `limit` no matter what the caller requests. */
  maxLimit: number;
}

export interface ParsedPagination {
  /** Effective page size after default + cap. */
  limit: number;
  /** Cursor id from `?cursor=<id>` or null. */
  cursor: string | null;
}

export function parsePagination(
  req: NextRequest,
  { defaultLimit, maxLimit }: PaginationOpts,
): ParsedPagination {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("limit");
  const parsed = raw === null ? defaultLimit : parseInt(raw, 10);
  const limit = Math.min(
    Math.max(1, Number.isFinite(parsed) && parsed > 0 ? parsed : defaultLimit),
    maxLimit,
  );
  return { limit, cursor: searchParams.get("cursor") };
}

/**
 * Slice off the trailing "extra" row that tells us another page exists,
 * and produce a `{ items, nextCursor }` envelope.
 *
 * Callers should always fetch `limit + 1` rows so we can detect a next page
 * without an extra query.
 */
export function buildPage<T extends { id: string }>(
  rows: T[],
  limit: number,
): { items: T[]; nextCursor: string | null } {
  if (rows.length > limit) {
    const items = rows.slice(0, limit);
    return { items, nextCursor: items[items.length - 1]!.id };
  }
  return { items: rows, nextCursor: null };
}
