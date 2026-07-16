import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import net from "node:net";
import tls from "node:tls";
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
  /**
   * Identity and invitation flows must use a shared store in production.
   * Per-instance memory counters are not a meaningful protection there.
   */
  requireSharedStore?: boolean;
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
  /** The endpoint requires Redis but it is unavailable in production. */
  unavailable?: boolean;
}

function getClientIp(req: NextRequest): string {
  const vercel = req.headers.get("x-vercel-forwarded-for");
  if (vercel) return vercel.split(",")[0]!.trim();
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
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

function redisUrlConfig(): string | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "redis:" && parsed.protocol !== "rediss:") return null;
    return url;
  } catch {
    return null;
  }
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

function respCommand(args: (string | number)[]): Buffer {
  const parts: Buffer[] = [Buffer.from(`*${args.length}\r\n`)];
  for (const arg of args) {
    const value = String(arg);
    const data = Buffer.from(value);
    parts.push(Buffer.from(`$${data.byteLength}\r\n`), data, Buffer.from("\r\n"));
  }
  return Buffer.concat(parts);
}

function parseRespReply(
  buffer: Buffer,
  offset: number,
): { value: unknown; nextOffset: number } | null {
  if (offset >= buffer.length) return null;
  const prefix = String.fromCharCode(buffer[offset]!);
  const lineEnd = buffer.indexOf("\r\n", offset);
  if (lineEnd === -1) return null;
  const line = buffer.subarray(offset + 1, lineEnd).toString();
  const next = lineEnd + 2;

  if (prefix === "+") return { value: line, nextOffset: next };
  if (prefix === "-") throw new Error(`redis: ${line}`);
  if (prefix === ":") return { value: Number(line), nextOffset: next };

  if (prefix === "$") {
    const length = Number(line);
    if (length === -1) return { value: null, nextOffset: next };
    const dataEnd = next + length;
    if (buffer.length < dataEnd + 2) return null;
    return {
      value: buffer.subarray(next, dataEnd).toString(),
      nextOffset: dataEnd + 2,
    };
  }

  if (prefix === "*") {
    const count = Number(line);
    if (count === -1) return { value: null, nextOffset: next };
    const values: unknown[] = [];
    let childOffset = next;
    for (let i = 0; i < count; i += 1) {
      const child = parseRespReply(buffer, childOffset);
      if (!child) return null;
      values.push(child.value);
      childOffset = child.nextOffset;
    }
    return { value: values, nextOffset: childOffset };
  }

  throw new Error(`redis: unsupported RESP prefix ${prefix}`);
}

async function redisUrlPipeline(
  redisUrl: string,
  commands: (string | number)[][],
  timeoutMs = 500,
): Promise<unknown[]> {
  const parsed = new URL(redisUrl);
  const useTls = parsed.protocol === "rediss:";
  const port = Number(parsed.port || (useTls ? 6380 : 6379));
  const host = parsed.hostname;
  const authCommands: (string | number)[][] = [];
  const username = decodeURIComponent(parsed.username || "");
  const password = decodeURIComponent(parsed.password || "");
  if (username && password) authCommands.push(["AUTH", username, password]);
  else if (password) authCommands.push(["AUTH", password]);

  const expectedReplies = authCommands.length + commands.length;
  const payload = Buffer.concat([...authCommands, ...commands].map(respCommand));

  return new Promise((resolve, reject) => {
    let settled = false;
    let buffer = Buffer.alloc(0);
    const replies: unknown[] = [];
    const socket = useTls
      ? tls.connect({ host, port, servername: host })
      : net.connect({ host, port });

    const timer = setTimeout(() => {
      finish(new Error("redis: request timed out"));
    }, timeoutMs);

    function finish(err?: Error) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      if (err) reject(err);
      else resolve(replies.slice(authCommands.length));
    }

    socket.once("error", (err) => finish(err));
    socket.once("connect", () => socket.write(payload));
    socket.on("data", (chunk) => {
      try {
        buffer = Buffer.concat([buffer, chunk]);
        let offset = 0;
        while (replies.length < expectedReplies) {
          const parsedReply = parseRespReply(buffer, offset);
          if (!parsedReply) break;
          replies.push(parsedReply.value);
          offset = parsedReply.nextOffset;
        }
        if (offset > 0) buffer = buffer.subarray(offset);
        if (replies.length >= expectedReplies) finish();
      } catch (err) {
        finish(err instanceof Error ? err : new Error(String(err)));
      }
    });
  });
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

function sharedStoreRequired(opts: RateLimitOptions): boolean {
  return Boolean(opts.requireSharedStore && process.env.NODE_ENV === "production");
}

function unavailableResult(opts: RateLimitOptions): RateLimitResult {
  return {
    ok: false,
    remaining: 0,
    retryAfter: 60,
    backend: "memory",
    degraded: true,
    unavailable: true,
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
  const redisUrl = redisUrlConfig();
  if (!cfg && !redisUrl) {
    warnOnce("UPSTASH_REDIS_REST_URL / TOKEN or REDIS_URL not configured");
    if (sharedStoreRequired(opts)) return unavailableResult(opts);
    return memoryCheck(bucketKey, opts, { bucket, ipHash });
  }

  const now = Date.now();
  const windowStart = now - (now % opts.windowMs);
  const ttlSec = Math.ceil(opts.windowMs / 1000);
  const redisKey = `rl:${bucket}:${ipHash}:${windowStart}`;

  try {
    const commands: (string | number)[][] = [
      ["INCR", redisKey],
      ["EXPIRE", redisKey, ttlSec, "NX"],
    ];
    const [countRaw] = cfg
      ? await upstashPipeline(cfg, commands)
      : await redisUrlPipeline(redisUrl!, commands);
    const count = typeof countRaw === "number" ? countRaw : Number(countRaw);
    if (!Number.isFinite(count)) throw new Error("redis: non-numeric INCR result");

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
    if (sharedStoreRequired(opts)) return unavailableResult(opts);
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
  if (result.unavailable) {
    return NextResponse.json(
      { error: "Security protection is temporarily unavailable. Please try again shortly." },
      {
        status: 503,
        headers: {
          "Retry-After": String(Math.max(1, result.retryAfter)),
          "X-RateLimit-Remaining": "0",
        },
      },
    );
  }
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
  required: boolean;
  error?: string;
}> {
  const required = process.env.NODE_ENV === "production";
  const cfg = upstashConfig();
  const redisUrl = redisUrlConfig();
  if (!cfg && !redisUrl) {
    return {
      configured: false,
      ok: !required,
      backend: "memory",
      required,
      ...(required ? { error: "shared rate-limit store is not configured" } : {}),
    };
  }
  try {
    const [pong] = cfg
      ? await upstashPipeline(cfg, [["PING"]], 500)
      : await redisUrlPipeline(redisUrl!, [["PING"]], 500);
    if (pong !== "PONG") throw new Error(`unexpected ping result: ${String(pong)}`);
    return { configured: true, ok: true, backend: "redis", required };
  } catch (err) {
    return {
      configured: true,
      ok: false,
      backend: "memory",
      required,
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
