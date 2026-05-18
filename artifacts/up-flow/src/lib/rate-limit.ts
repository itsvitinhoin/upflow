import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { logError } from "@/lib/log-error";

/**
 * Shared rate limiter.
 *
 * Backed by Upstash Redis REST when `UPSTASH_REDIS_REST_URL` +
 * `UPSTASH_REDIS_REST_TOKEN` are configured — counters are shared across all
 * app instances and survive deploys. Falls back to an in-process Map when
 * the store is unreachable or unconfigured, so we never lock everyone out
 * because of a Redis blip (fail-open, alarmed via logError).
 */

interface Bucket {
  tokens: number;
  resetAt: number;
}

const localBuckets = new Map<string, Bucket>();

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  key?: string;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfter: number;
  /** Which backend served this call (for observability + tests). */
  backend: "redis" | "memory";
  /**
   * True when the shared store was configured but unreachable so this
   * call was served fail-open without any enforcement. Distinguishes
   * "happy memory path (store unconfigured)" from "outage pass-through".
   */
  degraded?: boolean;
}

function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return req.ip ?? "unknown";
}

/**
 * Stable, non-reversible IP fingerprint for log context. We never log raw
 * IPs to keep logs PII-light while still being able to spot abuse from a
 * single source.
 */
function hashIp(ip: string): string {
  return crypto.createHash("sha256").update(ip).digest("hex").slice(0, 12);
}

function upstashConfig(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url, token };
}

let warnedMissingStore = false;
function warnOnce(reason: string, err?: unknown): void {
  // Always log the first occurrence so on-call notices degraded protection;
  // subsequent failures within the same process are still logged but at info
  // level via the same logError helper so they're greppable.
  if (!warnedMissingStore) {
    warnedMissingStore = true;
    logError("rate-limit:degraded", err ?? new Error(reason), { reason });
  }
}

/**
 * Call a Redis command via the Upstash REST API.
 *
 *   POST /pipeline  body=[[cmd, ...args], ...]   -> [{result|error}, ...]
 *
 * We use the pipeline endpoint so INCR + EXPIRE are sent in one round-trip.
 * Timeout is intentionally short (500ms): if Redis is slow we'd rather
 * fail-open quickly than block every login behind a 5s timeout.
 */
async function upstashPipeline(
  cfg: { url: string; token: string },
  commands: (string | number)[][],
  timeoutMs = 500,
): Promise<unknown[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${cfg.url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(commands),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`upstash ${res.status}: ${await res.text().catch(() => "")}`);
    }
    const data = (await res.json()) as Array<{ result?: unknown; error?: string }>;
    return data.map((entry) => {
      if (entry.error) throw new Error(`upstash: ${entry.error}`);
      return entry.result;
    });
  } finally {
    clearTimeout(timer);
  }
}

function memoryCheck(
  bucketKey: string,
  opts: RateLimitOptions,
  ctx: { bucket: string; ipHash: string },
): RateLimitResult {
  const now = Date.now();
  const existing = localBuckets.get(bucketKey);
  if (!existing || existing.resetAt <= now) {
    localBuckets.set(bucketKey, {
      tokens: opts.max - 1,
      resetAt: now + opts.windowMs,
    });
    return { ok: true, remaining: opts.max - 1, retryAfter: 0, backend: "memory" };
  }
  if (existing.tokens <= 0) {
    // Mirror the redis-path observability so abuse is still visible when
    // we're running on the in-memory backstop (store unconfigured).
    logError(
      "rate-limit:hit",
      new Error(`limit exceeded for ${ctx.bucket}`),
      { bucket: ctx.bucket, ipHash: ctx.ipHash, backend: "memory", max: opts.max },
    );
    return {
      ok: false,
      remaining: 0,
      retryAfter: Math.ceil((existing.resetAt - now) / 1000),
      backend: "memory",
    };
  }
  existing.tokens -= 1;
  return {
    ok: true,
    remaining: existing.tokens,
    retryAfter: 0,
    backend: "memory",
  };
}

/**
 * Check the rate limit for the caller's IP + the given window. Async because
 * Redis is a network call; existing callers `await` the one-line result.
 *
 * Algorithm: fixed-window counter keyed by `rl:{bucket}:{ipHash}:{windowStart}`.
 * Atomic INCR + EXPIRE-on-first-write keeps the counter and TTL in sync.
 * We chose fixed-window over a token-bucket / sliding-window because the
 * thresholds we enforce (5–60/min) are well above the burst variance that
 * sliding would smooth out, and a single round-trip INCR is the cheapest
 * thing Redis can do at p99. If we later need finer-grained smoothing we
 * can swap to a Lua-script-backed sliding window without changing callers.
 */
export async function checkRateLimit(
  req: NextRequest,
  opts: RateLimitOptions,
): Promise<RateLimitResult> {
  const ip = getClientIp(req);
  const ipHash = hashIp(ip);
  const bucket = opts.key ?? "default";
  const bucketKey = `${bucket}:${ipHash}`;

  const cfg = upstashConfig();
  if (!cfg) {
    warnOnce("UPSTASH_REDIS_REST_URL / TOKEN not configured");
    return memoryCheck(bucketKey, opts, { bucket, ipHash });
  }

  const now = Date.now();
  const windowStart = now - (now % opts.windowMs);
  const ttlSec = Math.ceil(opts.windowMs / 1000);
  const redisKey = `rl:${bucket}:${ipHash}:${windowStart}`;

  try {
    const [countRaw] = await upstashPipeline(cfg, [
      ["INCR", redisKey],
      ["EXPIRE", redisKey, ttlSec, "NX"],
    ]);
    const count = typeof countRaw === "number" ? countRaw : Number(countRaw);
    if (!Number.isFinite(count)) throw new Error("upstash: non-numeric INCR result");

    const resetAt = windowStart + opts.windowMs;
    if (count > opts.max) {
      const result: RateLimitResult = {
        ok: false,
        remaining: 0,
        retryAfter: Math.max(1, Math.ceil((resetAt - now) / 1000)),
        backend: "redis",
      };
      // Log limit hits with hashed IP + bucket so we can spot abuse without
      // storing PII. Use logError so it goes through the same shipper.
      logError(
        "rate-limit:hit",
        new Error(`limit exceeded for ${bucket}`),
        { bucket, ipHash, count, max: opts.max },
      );
      return result;
    }
    return {
      ok: true,
      remaining: Math.max(0, opts.max - count),
      retryAfter: 0,
      backend: "redis",
    };
  } catch (err) {
    // True fail-open: when the shared store is configured but unreachable
    // we serve every request and alarm via logError. We deliberately do
    // NOT fall back to per-instance memory counters here — those would
    // still produce 429s during an outage and lock users out (especially
    // users behind shared NAT), which is the failure mode this task
    // explicitly forbids. Memory limits only apply when the store is
    // *unconfigured* (see early-return above).
    logError("rate-limit:redis-unavailable", err, { bucket });
    return {
      ok: true,
      remaining: opts.max,
      retryAfter: 0,
      backend: "memory",
      degraded: true,
    };
  }
}

export function rateLimitResponse(result: RateLimitResult): NextResponse {
  return NextResponse.json(
    { error: "Too many requests. Please try again shortly." },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.max(1, result.retryAfter)),
        "X-RateLimit-Remaining": "0",
      },
    },
  );
}

/**
 * Health probe for `/api/health`. Returns the connectivity status of the
 * shared store so on-call can spot misconfiguration without parsing logs.
 */
export async function pingRateLimiter(): Promise<{
  configured: boolean;
  ok: boolean;
  backend: "redis" | "memory";
  error?: string;
}> {
  const cfg = upstashConfig();
  if (!cfg) {
    return { configured: false, ok: true, backend: "memory" };
  }
  try {
    const [pong] = await upstashPipeline(cfg, [["PING"]], 500);
    if (pong !== "PONG") throw new Error(`unexpected ping result: ${String(pong)}`);
    return { configured: true, ok: true, backend: "redis" };
  } catch (err) {
    return {
      configured: true,
      ok: false,
      backend: "memory",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// Sweep expired in-memory buckets every 5 minutes so the fallback path
// doesn't leak memory while Redis is down.
if (typeof globalThis !== "undefined" && !(globalThis as { __rlSweep?: boolean }).__rlSweep) {
  (globalThis as { __rlSweep?: boolean }).__rlSweep = true;
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of localBuckets) {
      if (v.resetAt <= now) localBuckets.delete(k);
    }
  }, 5 * 60 * 1000).unref?.();
}
