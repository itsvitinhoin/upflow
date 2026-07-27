import { NextRequest, NextResponse } from "next/server";
import { getEmailOrigin } from "@/lib/email/origin";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { readPasswordRecoveryTokenHash } from "@/lib/supabase/recovery-state";
import { withErrorReporting } from "@/lib/with-error-reporting";

export const runtime = "nodejs";

const MAX_REQUEST_BYTES = 8 * 1024;

function invalidStateResponse() {
  return NextResponse.json(
    { error: "This password reset link is invalid or has expired." },
    {
      status: 400,
      headers: {
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    },
  );
}

/**
 * Resolve the opaque reset-email state only after a person clicks Continue.
 * The Supabase recovery token is never present in the email URL or browser
 * history. The browser exchanges the returned token hash with Supabase.
 */
async function POST_handler(req: NextRequest) {
  const rl = await checkRateLimit(req, {
    windowMs: 60_000,
    max: 20,
    key: "forgot-continue",
    requireSharedStore: true,
  });
  if (!rl.ok) return rateLimitResponse(rl);

  const body = await readLimitedJson(req);
  const state = typeof body?.state === "string" ? body.state : null;
  if (!state) return invalidStateResponse();

  let expectedAppOrigin: string;
  try {
    expectedAppOrigin = getEmailOrigin(req);
  } catch {
    return invalidStateResponse();
  }

  const tokenHash = readPasswordRecoveryTokenHash({
    state,
    secret: process.env.SUPABASE_SERVICE_ROLE_KEY,
    expectedAppOrigin,
  });
  if (!tokenHash) return invalidStateResponse();

  return NextResponse.json(
    { tokenHash },
    {
      headers: {
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    },
  );
}

export const POST = withErrorReporting("api:auth:forgot:continue:POST", POST_handler);

async function readLimitedJson(req: NextRequest): Promise<{ state?: unknown } | null> {
  const declaredLength = req.headers.get("content-length");
  if (declaredLength && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > MAX_REQUEST_BYTES)) {
    return null;
  }

  const reader = req.body?.getReader();
  if (!reader) return null;

  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > MAX_REQUEST_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }

  try {
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const body = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    return body && typeof body === "object" ? (body as { state?: unknown }) : null;
  } catch {
    return null;
  }
}
