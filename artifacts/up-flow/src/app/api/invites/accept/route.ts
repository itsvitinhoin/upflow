import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth-helpers";
import { WORKSPACE_COOKIE } from "@/lib/workspace";

// Look up an invite by token (used by the accept page to render workspace info).
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Token required" }, { status: 400 });

  const invite = await prisma.workspaceInvite.findUnique({
    where: { token },
    select: {
      id: true,
      email: true,
      role: true,
      accepted_at: true,
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
// the invite, we attach them to the workspace and switch their active one.
export async function POST(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) {
    return NextResponse.json({ error: "Sign in to accept" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { token?: string };
  const token = body.token?.trim();
  if (!token) return NextResponse.json({ error: "Token required" }, { status: 400 });

  const preview = await prisma.workspaceInvite.findUnique({
    where: { token },
    select: { email: true },
  });
  if (!preview) return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  if (preview.email.toLowerCase() !== auth.prismaUser.email.toLowerCase()) {
    return NextResponse.json(
      { error: "This invite is for a different email" },
      { status: 403 },
    );
  }

  let invite: { workspace_id: string } | null = null;
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
        },
      });
      if (!fresh) throw new Error("not_found");
      if (fresh.accepted_at) throw new Error("already_used");

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
          role: fresh.role,
        },
        update: { role: fresh.role },
      });
      await tx.workspaceInvite.update({
        where: { id: fresh.id },
        data: { accepted_at: new Date() },
      });
      return { workspace_id: fresh.workspace_id };
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

  const res = NextResponse.json({
    success: true,
    workspace_id: invite!.workspace_id,
  });
  res.cookies.set(WORKSPACE_COOKIE, invite!.workspace_id, {
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
