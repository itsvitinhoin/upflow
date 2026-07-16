import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-response";
import { ensureOwnedWorkspace, WORKSPACE_COOKIE } from "@/lib/workspace";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { hashInviteToken, isInviteExpired, maskInviteEmail } from "@/lib/invite-token";
import { sendEmail } from "@/lib/email/send";
import { inviteAcceptedEmail } from "@/lib/email/templates";
import { getEmailOrigin } from "@/lib/email/origin";
import { logError } from "@/lib/log-error";
import { withErrorReporting } from "@/lib/with-error-reporting";

function normalizeInviteMemberRole(role: string | null | undefined): "admin" | "member" | "guest" {
  if (role === "admin") return "admin";
  if (role === "guest") return "guest";
  return "member";
}

function invalidInvite(status = 404) {
  return NextResponse.json({ error: "Invite not found" }, { status });
}

function expiredInvite() {
  return NextResponse.json(
    { error: "Invite expired. Ask an administrator to send a new one." },
    { status: 410 },
  );
}

// Public preview deliberately exposes only the information needed to decide
// whether to proceed. It never returns an email address, id, or token hash.
async function GET_handler(req: NextRequest) {
  const rl = await checkRateLimit(req, {
    windowMs: 60_000,
    max: 60,
    key: "invite-preview",
    requireSharedStore: true,
  });
  if (!rl.ok) return rateLimitResponse(rl);

  const { searchParams } = new URL(req.url);
  const tokenHash = hashInviteToken(searchParams.get("token"));
  if (!tokenHash) return invalidInvite();

  const invite = await prisma.workspaceInvite.findUnique({
    where: { token_hash: tokenHash },
    select: {
      email: true,
      role: true,
      tester_invite: true,
      invite_mode: true,
      accepted_at: true,
      expires_at: true,
      workspace: { select: { name: true } },
      inviter: { select: { name: true } },
    },
  });
  if (!invite) return invalidInvite();
  if (invite.accepted_at) {
    return NextResponse.json({ error: "Invite already used" }, { status: 410 });
  }
  if (isInviteExpired(invite.expires_at)) return expiredInvite();

  return NextResponse.json({
    role: invite.role,
    tester_invite: invite.tester_invite,
    invite_mode: invite.invite_mode,
    expires_at: invite.expires_at,
    email_hint: maskInviteEmail(invite.email),
    workspace: { name: invite.workspace.name },
    inviter: invite.inviter ? { name: invite.inviter.name } : null,
  });
}

// Accept an invite. The caller must be authenticated and use the invited
// email. The token is hashed before every database lookup.
async function POST_handler(req: NextRequest) {
  const rl = await checkRateLimit(req, {
    windowMs: 60_000,
    max: 20,
    key: "invite-accept",
    requireSharedStore: true,
  });
  if (!rl.ok) return rateLimitResponse(rl);

  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;

  const body = (await req.json().catch(() => ({}))) as { token?: string };
  const tokenHash = hashInviteToken(body.token);
  if (!tokenHash) return invalidInvite();

  const preview = await prisma.workspaceInvite.findUnique({
    where: { token_hash: tokenHash },
    select: { email: true, tester_invite: true, invite_mode: true, expires_at: true, accepted_at: true },
  });
  if (!preview) return invalidInvite();
  if (preview.accepted_at) {
    return NextResponse.json({ error: "Invite already used" }, { status: 410 });
  }
  if (isInviteExpired(preview.expires_at)) return expiredInvite();
  if (preview.email.toLowerCase() !== auth.prismaUser.email.toLowerCase()) {
    return NextResponse.json({ error: "This invite is no longer valid" }, { status: 403 });
  }

  const joinsSourceWorkspace =
    preview.tester_invite || preview.invite_mode === "workspace_access";
  const ownedWorkspace = joinsSourceWorkspace
    ? null
    : await ensureOwnedWorkspace(
        auth.prismaUser.id,
        auth.prismaUser.name || auth.prismaUser.email.split("@")[0] || "My",
      );

  let invite:
    | { source_workspace_id: string; target_workspace_id: string; role: string }
    | null = null;
  try {
    invite = await prisma.$transaction(async (tx) => {
      // Re-read inside the transaction so concurrent accepts cannot both win.
      const fresh = await tx.workspaceInvite.findUnique({
        where: { token_hash: tokenHash },
        select: {
          id: true,
          role: true,
          email: true,
          accepted_at: true,
          expires_at: true,
          workspace_id: true,
          tester_invite: true,
          invite_mode: true,
        },
      });
      if (!fresh) throw new Error("not_found");
      if (fresh.accepted_at) throw new Error("already_used");
      if (isInviteExpired(fresh.expires_at)) throw new Error("expired");
      if (fresh.email.toLowerCase() !== auth.prismaUser.email.toLowerCase()) {
        throw new Error("email_mismatch");
      }

      const joinsWorkspace =
        fresh.tester_invite || fresh.invite_mode === "workspace_access";
      const acceptedRole = normalizeInviteMemberRole(fresh.role);

      // A read followed by an unconditional update can be won twice under
      // Postgres' normal read-committed isolation. Claim the still-pending,
      // still-valid invite before granting membership so a replay loses.
      const claimed = await tx.workspaceInvite.updateMany({
        where: {
          id: fresh.id,
          accepted_at: null,
          expires_at: { gt: new Date() },
        },
        data: { accepted_at: new Date(), accepted_by: auth.prismaUser.id },
      });
      if (claimed.count !== 1) throw new Error("already_used");

      if (joinsWorkspace) {
        await tx.workspaceMember.upsert({
          where: {
            workspace_id_user_id: {
              workspace_id: fresh.workspace_id,
              user_id: auth.prismaUser.id,
            },
          },
          create: {
            workspace_id: fresh.workspace_id,
            user_id: auth.prismaUser.id,
            role: acceptedRole,
          },
          update: { role: acceptedRole, status: "active" },
        });
      }
      return {
        source_workspace_id: fresh.workspace_id,
        target_workspace_id: joinsWorkspace ? fresh.workspace_id : ownedWorkspace!.id,
        role: fresh.role,
      };
    });
  } catch (error) {
    const message = (error as Error).message;
    if (message === "not_found") return invalidInvite();
    if (message === "already_used") {
      return NextResponse.json({ error: "Invite already used" }, { status: 410 });
    }
    if (message === "expired") return expiredInvite();
    if (message === "email_mismatch") {
      return NextResponse.json({ error: "This invite is no longer valid" }, { status: 403 });
    }
    throw error;
  }

  // Notify workspace admins after the durable membership/invite transaction.
  try {
    const workspaceId = invite.source_workspace_id;
    const [workspace, admins] = await Promise.all([
      prisma.workspace.findUnique({ where: { id: workspaceId }, select: { name: true } }),
      prisma.workspaceMember.findMany({
        where: { workspace_id: workspaceId, role: { in: ["owner", "admin"] } },
        select: { user: { select: { email: true, id: true } } },
      }),
    ]);
    const joinedRole = normalizeInviteMemberRole(invite.role);
    const adminUserIds = admins
      .map((member) => member.user.id)
      .filter((id) => id !== auth.prismaUser.id);
    if (adminUserIds.length > 0) {
      await prisma.notification.createMany({
        data: adminUserIds.map((userId) => ({
          type: "member_joined" as const,
          user_id: userId,
          workspace_id: workspaceId,
          data: {
            new_member_id: auth.prismaUser.id,
            new_member_email: auth.prismaUser.email,
            new_member_name: auth.prismaUser.name || auth.prismaUser.email,
            role: joinedRole,
          },
        })),
      });
    }
    const origin = getEmailOrigin(req);
    const recipients = admins
      .map((member) => member.user.email)
      .filter((email): email is string =>
        Boolean(email) && email.toLowerCase() !== auth.prismaUser.email.toLowerCase(),
      );
    if (recipients.length > 0) {
      const rendered = inviteAcceptedEmail({
        workspaceName: workspace?.name ?? "your team",
        newMemberEmail: auth.prismaUser.email,
        newMemberName: auth.prismaUser.name || auth.prismaUser.email,
        role: joinedRole,
        workspaceUrl: `${origin}/`,
      });
      await Promise.all(
        recipients.map((to) =>
          sendEmail({
            to,
            subject: rendered.subject,
            html: rendered.html,
            text: rendered.text,
            scope: "invites:accepted",
          }),
        ),
      );
    }
  } catch (error) {
    logError("invites:accept:notify", error);
  }

  const targetWorkspace =
    ownedWorkspace ??
    (await prisma.workspace.findUnique({
      where: { id: invite.target_workspace_id },
      select: { id: true, name: true, slug: true },
    }));

  const response = NextResponse.json({
    success: true,
    workspace_id: invite.target_workspace_id,
    workspace: targetWorkspace,
    source_workspace_id: invite.source_workspace_id,
  });
  response.cookies.set(WORKSPACE_COOKIE, invite.target_workspace_id, {
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}

export const GET = withErrorReporting("api:invites/accept:GET", GET_handler);
export const POST = withErrorReporting("api:invites/accept:POST", POST_handler);
