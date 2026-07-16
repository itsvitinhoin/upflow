import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isWorkspaceAdmin, isWorkspaceAdminFor } from "@/lib/auth-helpers";
import { requireAuth } from "@/lib/auth-response";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { emailIsConfigured, sendEmail } from "@/lib/email/send";
import { inviteEmail } from "@/lib/email/templates";
import { getEmailOrigin, EmailOriginError } from "@/lib/email/origin";
import { reconcileAcceptedWorkspaceInvites } from "@/lib/invite-reconciliation";
import { generateInviteToken, hashInviteToken, inviteExpiry, isInviteExpired } from "@/lib/invite-token";
import { logError } from "@/lib/log-error";
import { withErrorReporting } from "@/lib/with-error-reporting";

type InviteFailureCode =
  | "APP_URL_MISSING"
  | "EMAIL_NOT_CONFIGURED"
  | "EMAIL_SEND_FAILED";
type InviteMode = "workspace_access" | "personal_workspace";

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

// GET: list pending invites for the active workspace (admin only).
// Never return token hashes or bearer links from this endpoint.
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

  await reconcileAcceptedWorkspaceInvites(targetWorkspaceId);

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
      tester_invite: true,
      invite_mode: true,
      send_status: true,
      send_error: true,
      last_sent_at: true,
      accepted_by: true,
      accepted_at: true,
      expires_at: true,
      created_at: true,
      workspace: { select: { id: true, name: true, slug: true } },
      inviter: { select: { id: true, name: true, email: true } },
    },
  });
  return NextResponse.json(
    invites.map((invite) => ({
      ...invite,
      expired: !invite.accepted_at && isInviteExpired(invite.expires_at),
    })),
  );
}

// POST: create one invite per email and send the only copy of each bearer link.
async function POST_handler(req: NextRequest) {
  const rl = await checkRateLimit(req, {
    windowMs: 60_000,
    max: 20,
    key: "invite",
    requireSharedStore: true,
  });
  if (!rl.ok) return rateLimitResponse(rl);

  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  if (!isWorkspaceAdmin(auth) || !auth.currentWorkspaceId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    emails?: string[];
    role?: "admin" | "member" | "guest";
    workspace_id?: string;
    tester_invite?: boolean;
    mode?: InviteMode;
  };
  const emails = (body.emails || [])
    .map((email) => (typeof email === "string" ? email.trim().toLowerCase() : ""))
    .filter(Boolean);

  if (emails.length === 0) {
    return NextResponse.json({ error: "At least one email is required" }, { status: 400 });
  }
  if (emails.length > 50) {
    return NextResponse.json({ error: "Too many invites in one request" }, { status: 400 });
  }
  const re = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  const invalid = emails.find((email) => !re.test(email));
  if (invalid) {
    return NextResponse.json({ error: `Invalid email: ${invalid}` }, { status: 400 });
  }

  const targetWorkspaceId = body.workspace_id?.trim() || auth.currentWorkspaceId;
  const testerInvite = body.tester_invite === true;
  const inviteMode: InviteMode = testerInvite
    ? "workspace_access"
    : body.mode === "personal_workspace"
      ? "personal_workspace"
      : "workspace_access";
  const role: "admin" | "member" | "guest" =
    inviteMode === "workspace_access" && body.role === "admin"
      ? "admin"
      : inviteMode === "workspace_access" && body.role === "guest"
        ? "guest"
        : "member";

  if (!targetWorkspaceId || !isWorkspaceAdminFor(auth, targetWorkspaceId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const unique = Array.from(new Set(emails));
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

  const workspace = await prisma.workspace.findUnique({
    where: { id: targetWorkspaceId },
    select: { name: true },
  });
  const inviterName = auth.prismaUser.name || auth.prismaUser.email;
  const inviterEmail = auth.prismaUser.email;

  const created = await Promise.all(
    unique.map(async (email) => {
      const existing = await prisma.workspaceInvite.findFirst({
        where: {
          workspace_id: targetWorkspaceId,
          email,
          role,
          invite_mode: inviteMode,
          accepted_at: null,
        },
        select: { id: true },
      });

      const token = generateInviteToken();
      const tokenHash = hashInviteToken(token);
      if (!tokenHash) throw new Error("generated invite token failed validation");
      const data = {
        token_hash: tokenHash,
        expires_at: inviteExpiry(),
        invited_by: auth.prismaUser.id,
        tester_invite: testerInvite,
        invite_mode: inviteMode,
        send_status: "pending" as const,
        send_error: null,
      };
      const select = {
        id: true,
        email: true,
        role: true,
        tester_invite: true,
        invite_mode: true,
        send_status: true,
        send_error: true,
        last_sent_at: true,
        accepted_at: true,
        expires_at: true,
        created_at: true,
      } as const;
      const invite = existing
        ? await prisma.workspaceInvite.update({ where: { id: existing.id }, data, select })
        : await prisma.workspaceInvite.create({
            data: { workspace_id: targetWorkspaceId, email, role, ...data },
            select,
          });

      return {
        ...invite,
        token,
        acceptUrl: `${origin}/invite/${token}`,
        reused: Boolean(existing),
      };
    }),
  );

  let mailed = 0;
  for (const invite of created) {
    const rendered = inviteEmail({
      workspaceName:
        inviteMode === "workspace_access" ? workspace?.name ?? "your workspace" : "Up Flow",
      inviterName,
      inviterEmail,
      acceptUrl: invite.acceptUrl,
      role: invite.role === "admin" ? "admin" : invite.role === "guest" ? "guest" : "member",
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
        data: { send_status: "sent", send_error: null, last_sent_at: new Date() },
      });
      continue;
    }

    if (!invite.reused) {
      await prisma.workspaceInvite.delete({ where: { id: invite.id } }).catch((err) => {
        logError("invites:send:rollback", err, {
          invite_id: invite.id,
          recipientHash: emailFingerprint(invite.email),
        });
      });
    } else {
      await prisma.workspaceInvite.update({
        where: { id: invite.id },
        data: {
          send_status: "failed",
          send_error: result.error || "Email provider rejected the invite.",
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

  // Deliberately omit bearer tokens and accept URLs. Email delivery is the
  // only path that receives an invite credential after it is created.
  return NextResponse.json(
    {
      success: true,
      sent: created.length,
      mailed,
      invites: created.map(({ token: _token, acceptUrl: _acceptUrl, ...invite }) => invite),
    },
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
    return NextResponse.json({ error: "Accepted invites cannot be canceled" }, { status: 409 });
  }

  await prisma.workspaceInvite.delete({ where: { id: invite.id } });
  return NextResponse.json({ success: true });
}

export const GET = withErrorReporting("api:invites:GET", GET_handler);
export const POST = withErrorReporting("api:invites:POST", POST_handler);
export const DELETE = withErrorReporting("api:invites:DELETE", DELETE_handler);
