import { NextRequest, NextResponse } from "next/server";
import { isWorkspaceAdmin } from "@/lib/auth-helpers";
import { requireAuth } from "@/lib/auth-response";
import { emailIsConfigured, sendEmail } from "@/lib/email/send";
import { getEmailOrigin, EmailOriginError } from "@/lib/email/origin";
import { withErrorReporting } from "@/lib/with-error-reporting";

async function POST_handler(req: NextRequest) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;

  if (!isWorkspaceAdmin(auth) || !auth.currentWorkspaceId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let origin: string;
  try {
    origin = getEmailOrigin(req);
  } catch (err) {
    if (err instanceof EmailOriginError) {
      return NextResponse.json(
        {
          error: "Email test links require APP_URL to be configured.",
          code: "APP_URL_MISSING",
        },
        { status: 503 },
      );
    }
    throw err;
  }

  if (!emailIsConfigured()) {
    return NextResponse.json(
      {
        error: "Email backend not configured. Set RESEND_API_KEY before testing email.",
        code: "EMAIL_NOT_CONFIGURED",
      },
      { status: 503 },
    );
  }

  const result = await sendEmail({
    to: auth.prismaUser.email,
    subject: "UP Flow invite email test",
    html: `<p>Your UP Flow invite email backend accepted this test message.</p><p><a href="${origin}">Open UP Flow</a></p>`,
    text: `Your UP Flow invite email backend accepted this test message.\n\nOpen UP Flow: ${origin}`,
    scope: "email:test",
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error || "Email provider rejected the test message.",
        code: "EMAIL_SEND_FAILED",
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    success: true,
    mailed: 1,
    recipient: auth.prismaUser.email,
  });
}

export const POST = withErrorReporting("api:email/test:POST", POST_handler);
