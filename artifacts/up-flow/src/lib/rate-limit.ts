import { NextRequest, NextResponse } from "next/server";

interface Bucket {
  tokens: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return req.ip ?? "unknown";
}

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  key?: string;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfter: number;
}

export function checkRateLimit(
  req: NextRequest,
  opts: RateLimitOptions,
): RateLimitResult {
  const ip = getClientIp(req);
  const bucketKey = `${opts.key ?? "default"}:${ip}`;
  const now = Date.now();
  const existing = buckets.get(bucketKey);

  if (!existing || existing.resetAt <= now) {
    buckets.set(bucketKey, { tokens: opts.max - 1, resetAt: now + opts.windowMs });
    return { ok: true, remaining: opts.max - 1, retryAfter: 0 };
  }

  if (existing.tokens <= 0) {
    return {
      ok: false,
      remaining: 0,
      retryAfter: Math.ceil((existing.resetAt - now) / 1000),
    };
  }

  existing.tokens -= 1;
  return {
    ok: true,
    remaining: existing.tokens,
    retryAfter: 0,
  };
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

// Sweep expired buckets every 5 minutes to keep memory bounded.
if (typeof globalThis !== "undefined" && !(globalThis as { __rlSweep?: boolean }).__rlSweep) {
  (globalThis as { __rlSweep?: boolean }).__rlSweep = true;
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of buckets) {
      if (v.resetAt <= now) buckets.delete(k);
    }
  }, 5 * 60 * 1000).unref?.();
}
