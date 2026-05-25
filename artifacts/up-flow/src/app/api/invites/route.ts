import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { isWorkspaceAdmin, isWorkspaceAdminFor } from "@/lib/auth-helpers";
import { requireAuth } from "@/lib/auth-response";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { emailIsConfigured, sendEmail } from "@/lib/email/send";
import { inviteEmail } from "@/lib/email/templates";
import { getEmailOrigin, EmailOriginError } from "@/lib/email/origin";
import { logError } from "@/lib/log-error";
import { withErrorReporting } from "@/lib/with-error-reporting";

type InviteFailureCode =
  | "APP_URL_MISSING"
  | "EMAIL_NOT_CONFIGURED"
  | "EMAIL_SEND_FAILED";

function generateToken(): string {
  return randomBytes(24).toString("base64url");
}

function inviteFailure(
  code: InviteFailureCode,
  error: string,
  status = 503,
) {
  return NextResponse.json({ error, code }, { status });
}

function emailFingerprint(email: string): string {
  return createHash("sha256").update(email).digest("hex").slice(0, 12);
}

// GET: list pending invites for the active workspace (admin only)
async function GET_handler(req: NextRequest) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  const { searchParams } = new URL(req.url);
  const targetWorkspaceId =
    searchParams.get("workspace_id")?.trim() || auth.currentWorkspaceId;
  const include = searchParams.get("include");
  const testerOnly = searchParams.get("scope") === "testers";

  if (!targetWorkspaceId || !isWorkspaceAdminFor(auth, targetWorkspaceId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const invites = await prisma.workspaceInvite.findMany({
    where: {
      workspace_id: targetWorkspaceId,
      ...(include === "all" ? {} : { accepted_at: null }),
      ...(testerOnly ? { tester_invite: true } : {}),
    },
    orderBy: [
      { accepted_at: "desc" },
      { last_sent_at: "desc" },
      { created_at: "desc" },
    ],
    select: {
      id: true,
      email: true,
      role: true,
      token: true,
      tester_invite: true,
      send_status: true,
      send_error: true,
      last_sent_at: true,
      accepted_by: true,
      accepted_at: true,
      created_at: true,
      workspace: { select: { id: true, name: true, slug: true } },
      inviter: { select: { id: true, name: true, email: true } },
    },
  });
  return NextResponse.json(invites);
}

// POST: create one invite per email and return tokens / accept links.
async function POST_handler(req: NextRequest) {
  const rl = await checkRateLimit(req, { windowMs: 60_000, max: 20, key: "invite" });
  if (!rl.ok) return rateLimitResponse(rl);

  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  if (!isWorkspaceAdmin(auth) || !auth.currentWorkspaceId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    emails?: string[];
    role?: "admin" | "member";
    workspace_id?: string;
    tester_invite?: boolean;
  };
  const emails = (body.emails || [])
    .map((e) => (typeof e === "string" ? e.trim().toLowerCase() : ""))
    .filter(Boolean);

  if (emails.length === 0) {
    return NextResponse.json(
      { error: "At least one email is required" },
      { status: 400 },
    );
  }
  if (emails.length > 50) {
    return NextResponse.json(
      { error: "Too many invites in one request" },
      { status: 400 },
    );
  }
  const re = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  const invalid = emails.find((e) => !re.test(e));
  if (invalid) {
    return NextResponse.json(
      { error: `Invalid email: ${invalid}` },
      { status: 400 },
    );
  }
  const role: "admin" | "member" = body.role === "admin" ? "admin" : "member";
  const targetWorkspaceId = body.workspace_id?.trim() || auth.currentWorkspaceId;
  const testerInvite = body.tester_invite === true;

  if (!targetWorkspaceId || !isWorkspaceAdminFor(auth, targetWorkspaceId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // De-duplicate.
  const unique = Array.from(new Set(emails));

  // Invite links are only useful when they can be emailed. In production,
  // fail before creating tokens if the canonical app URL or provider config
  // is missing so admins never see a misleading "invited" success.
  let origin: string;
  try {
    origin = getEmailOrigin(req);
  } catch (err) {
    if (err instanceof EmailOriginError) {
      logError("invites:send", err, {
        code: "APP_URL_MISSING",
        recipientCount: unique.length,
      });
      return inviteFailure(
        "APP_URL_MISSING",
        "Email invite links require APP_URL to be configured.",
      );
    }
    throw err;
  }

  if (!emailIsConfigured()) {
    logError("invites:send", new Error("RESEND_API_KEY not set"), {
      code: "EMAIL_NOT_CONFIGURED",
      recipientCount: unique.length,
    });
    return inviteFailure(
      "EMAIL_NOT_CONFIGURED",
      "Email backend not configured. Set RESEND_API_KEY before sending invites.",
    );
  }

  // Pull workspace name once for the email body.
  const workspace = await prisma.workspace.findUnique({
    where: { id: targetWorkspaceId },
    select: { name: true },
  });
  const inviterName = auth.prismaUser.name || auth.prismaUser.email;
  const inviterEmail = auth.prismaUser.email;

  // Reuse an existing pending invite (workspace_id + email + role) so admins
  // calling this endpoint twice with the same address don't generate a pile
  // of dead tokens. If only the role differs we still create a fresh invite.
  const created = await Promise.all(
    unique.map(async (email) => {
      const existing = await prisma.workspaceInvite.findFirst({
        where: {
          workspace_id: targetWorkspaceId,
          email,
          role,
          accepted_at: null,
        },
        select: {
          id: true,
          email: true,
          role: true,
          token: true,
          tester_invite: true,
          send_status: true,
          send_error: true,
          last_sent_at: true,
          accepted_at: true,
          created_at: true,
        },
      });
      if (existing && testerInvite && !existing.tester_invite) {
        await prisma.workspaceInvite.update({
          where: { id: existing.id },
          data: { tester_invite: true },
        });
      }
      const invite =
        existing ??
        (await prisma.workspaceInvite.create({
          data: {
            workspace_id: targetWorkspaceId,
            email,
            role,
            token: generateToken(),
            invited_by: auth.prismaUser.id,
            tester_invite: testerInvite,
          },
          select: {
            id: true,
            email: true,
            role: true,
            token: true,
            tester_invite: true,
            send_status: true,
            send_error: true,
            last_sent_at: true,
            accepted_at: true,
            created_at: true,
          },
        }));
      return {
        ...invite,
        accept_url: `${origin}/invite/${invite.token}`,
        reused: existing !== null,
      };
    }),
  );

  // Send the invite emails. Production success means every provider call was
  // accepted; new records whose send fails are removed so pending invites do
  // not imply that an email actually went out.
  let mailed = 0;
  for (const invite of created) {
    const rendered = inviteEmail({
      workspaceName: workspace?.name ?? "your team",
      inviterName,
      inviterEmail,
      acceptUrl: invite.accept_url,
      role: invite.role === "admin" ? "admin" : "member",
    });
    const result = await sendEmail({
      to: invite.email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      replyTo: inviterEmail,
      scope: "invites:send",
    });
    if (result.ok) {
      mailed += 1;
      await prisma.workspaceInvite.update({
        where: { id: invite.id },
        data: {
          send_status: "sent",
          send_error: null,
          last_sent_at: new Date(),
          ...(testerInvite ? { tester_invite: true } : {}),
        },
      });
      continue;
    }

    if (!invite.reused) {
      await prisma.workspaceInvite
        .delete({ where: { id: invite.id } })
        .catch((err) => {
          logError("invites:send:rollback", err, {
            invite_id: invite.id,
            recipientHash: emailFingerprint(invite.email),
          });
        });
    }
    if (invite.reused) {
      await prisma.workspaceInvite.update({
        where: { id: invite.id },
        data: {
          send_status: "failed",
          send_error: result.error || "Email provider rejected the invite.",
          ...(testerInvite ? { tester_invite: true } : {}),
        },
      });
    }
    logError("invites:send", new Error(result.error ?? "unknown"), {
      code: "EMAIL_SEND_FAILED",
      invite_id: invite.id,
      recipientHash: emailFingerprint(invite.email),
      reused: invite.reused,
    });
    return inviteFailure(
      "EMAIL_SEND_FAILED",
      result.error || "Email provider rejected the invite.",
      502,
    );
  }

  return NextResponse.json(
    { success: true, sent: created.length, mailed, invites: created },
    { status: 201 },
  );
}

async function DELETE_handler(req: NextRequest) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;

  const { searchParams } = new URL(req.url);
  const body = (await req.json().catch(() => ({}))) as { id?: string };
  const id = body.id?.trim() || searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ error: "Invite id required" }, { status: 400 });

  const invite = await prisma.workspaceInvite.findUnique({
    where: { id },
    select: { id: true, workspace_id: true, accepted_at: true },
  });
  if (!invite) return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  if (!isWorkspaceAdminFor(auth, invite.workspace_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (invite.accepted_at) {
    return NextResponse.json(
      { error: "Accepted invites cannot be canceled" },
      { status: 409 },
    );
  }

  await prisma.workspaceInvite.delete({ where: { id: invite.id } });

  return NextResponse.json({ success: true });
}
export const GET = withErrorReporting("api:invites:GET", GET_handler);
export const POST = withErrorReporting("api:invites:POST", POST_handler);
export const DELETE = withErrorReporting("api:invites:DELETE", DELETE_handler);
