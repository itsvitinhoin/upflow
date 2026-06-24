import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-response";
import { ensureOwnedWorkspace, WORKSPACE_COOKIE } from "@/lib/workspace";
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

// Look up an invite by token (used by the accept page to render workspace info).
async function GET_handler(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Token required" }, { status: 400 });

  const invite = await prisma.workspaceInvite.findUnique({
    where: { token },
    select: {
      id: true,
      email: true,
      role: true,
      tester_invite: true,
      invite_mode: true,
      accepted_at: true,
      last_sent_at: true,
      workspace: { select: { id: true, name: true, slug: true } },
      inviter: { select: { name: true, email: true } },
    },
  });
  if (!invite) return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  if (invite.accepted_at) {
    return NextResponse.json({ error: "Invite already used" }, { status: 410 });
  }

  return NextResponse.json(invite);
}

// Accept an invite. The caller must be authenticated; if their email matches
// the invite, workspace-access invites attach them to the source workspace.
// Personal-workspace invites create or reuse the user's own workspace.
async function POST_handler(req: NextRequest) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;

  const body = (await req.json().catch(() => ({}))) as { token?: string };
  const token = body.token?.trim();
  if (!token) return NextResponse.json({ error: "Token required" }, { status: 400 });

  const preview = await prisma.workspaceInvite.findUnique({
    where: { token },
    select: { email: true, tester_invite: true, invite_mode: true },
  });
  if (!preview) return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  if (preview.email.toLowerCase() !== auth.prismaUser.email.toLowerCase()) {
    return NextResponse.json(
      { error: "This invite is for a different email" },
      { status: 403 },
    );
  }

  const joinsSourceWorkspace =
    preview.tester_invite || preview.invite_mode === "workspace_access";
  const ownedWorkspace = joinsSourceWorkspace
    ? null
    : await ensureOwnedWorkspace(
        auth.prismaUser.id,
        auth.prismaUser.name || auth.prismaUser.email.split("@")[0] || "My",
      );

  let invite: { source_workspace_id: string; target_workspace_id: string } | null = null;
  try {
    invite = await prisma.$transaction(async (tx) => {
      // Re-read inside the tx so two parallel accepts can't both succeed.
      const fresh = await tx.workspaceInvite.findUnique({
        where: { token },
        select: {
          id: true,
          role: true,
          accepted_at: true,
          workspace_id: true,
          tester_invite: true,
          invite_mode: true,
        },
      });
      if (!fresh) throw new Error("not_found");
      if (fresh.accepted_at) throw new Error("already_used");

      const joinsWorkspace =
        fresh.tester_invite || fresh.invite_mode === "workspace_access";
      const acceptedRole = normalizeInviteMemberRole(fresh.role);
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

      await tx.workspaceInvite.update({
        where: { id: fresh.id },
        data: { accepted_at: new Date(), accepted_by: auth.prismaUser.id },
      });
      return {
        source_workspace_id: fresh.workspace_id,
        target_workspace_id: joinsWorkspace ? fresh.workspace_id : ownedWorkspace!.id,
      };
    });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === "not_found") {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }
    if (msg === "already_used") {
      return NextResponse.json({ error: "Invite already used" }, { status: 410 });
    }
    throw e;
  }

  // Notify the workspace admins via in-app notification + email.
  try {
    const workspaceId = invite!.source_workspace_id;
    const [workspace, admins, acceptedInvite] = await Promise.all([
      prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { name: true },
      }),
      prisma.workspaceMember.findMany({
        where: { workspace_id: workspaceId, role: { in: ["owner", "admin"] } },
        select: { user: { select: { email: true, id: true } } },
      }),
      prisma.workspaceInvite.findUnique({
        where: { token },
        select: { role: true },
      }),
    ]);
    const joinedRole = normalizeInviteMemberRole(acceptedInvite?.role);

    // In-app notification rows for every admin (excluding the joining user
    // themselves, in case they were already a member promoted via invite).
    const adminUserIds = admins
      .map((m) => m.user.id)
      .filter((id) => id !== auth.prismaUser.id);
    if (adminUserIds.length > 0) {
      await prisma.notification.createMany({
        data: adminUserIds.map((uid) => ({
          type: "member_joined" as const,
          user_id: uid,
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
    // Notification email is best-effort; if APP_URL is missing in prod the
    // outer catch will log this and the accept still succeeds.
    const origin = getEmailOrigin(req);
    const role = joinedRole;
    const recipients = admins
      .map((m) => m.user.email)
      .filter((e): e is string => Boolean(e) && e.toLowerCase() !== auth.prismaUser.email.toLowerCase());
    if (recipients.length > 0) {
      const rendered = inviteAcceptedEmail({
        workspaceName: workspace?.name ?? "your team",
        newMemberEmail: auth.prismaUser.email,
        newMemberName: auth.prismaUser.name || auth.prismaUser.email,
        role,
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
  } catch (err) {
    logError("invites:accept:notify", err);
  }

  const targetWorkspace =
    ownedWorkspace ??
    (await prisma.workspace.findUnique({
      where: { id: invite!.target_workspace_id },
      select: { id: true, name: true, slug: true },
    }));

  const res = NextResponse.json({
    success: true,
    workspace_id: invite!.target_workspace_id,
    workspace: targetWorkspace,
    source_workspace_id: invite!.source_workspace_id,
  });
  res.cookies.set(WORKSPACE_COOKIE, invite!.target_workspace_id, {
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
export const GET = withErrorReporting("api:invites/accept:GET", GET_handler);
export const POST = withErrorReporting("api:invites/accept:POST", POST_handler);
