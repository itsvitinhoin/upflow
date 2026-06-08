import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { isSuperAdmin } from "@/lib/auth-helpers";
import { requireAuth } from "@/lib/auth-response";
import { TESTER_WORKSPACE_SLUG } from "@/lib/tester-workspace";
import { withErrorReporting } from "@/lib/with-error-reporting";

async function deleteSupabaseUsersByEmail(email: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return { attempted: false, deleted: 0, error: "SUPABASE_SERVICE_ROLE_KEY is not set" };
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  let deleted = 0;
  let page = 1;

  while (page <= 20) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) return { attempted: true, deleted, error: error.message };

    const matches = (data.users ?? []).filter(
      (user) => user.email?.toLowerCase() === email,
    );
    for (const user of matches) {
      const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
      if (deleteError) {
        return { attempted: true, deleted, error: deleteError.message };
      }
      deleted += 1;
    }

    if (!data.users || data.users.length < 1000 || matches.length > 0) break;
    page += 1;
  }

  return { attempted: true, deleted, error: null };
}

async function POST_handler(req: NextRequest) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  if (!isSuperAdmin(auth)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { email?: string };
  const email = body.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }
  if (email === auth.prismaUser.email.toLowerCase()) {
    return NextResponse.json(
      { error: "You cannot reset your own signed-in account" },
      { status: 400 },
    );
  }

  const testerWorkspace = await prisma.workspace.findUnique({
    where: { slug: TESTER_WORKSPACE_SLUG },
    select: { id: true },
  });

  const testerInvite = await prisma.workspaceInvite.findFirst({
    where: { email, tester_invite: true },
    select: { id: true },
  });

  const testerMembership =
    testerWorkspace &&
    (await prisma.workspaceMember.findFirst({
      where: {
        workspace_id: testerWorkspace.id,
        user: { email },
      },
      select: { id: true },
    }));

  if (!testerInvite && !testerMembership) {
    return NextResponse.json(
      {
        error:
          "Tester reset is limited to sandbox tester accounts. Remove normal workspace members from Team instead.",
      },
      { status: 400 },
    );
  }

  const appUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  const authReset = await deleteSupabaseUsersByEmail(email);

  const result = await prisma.$transaction(async (tx) => {
    const invites = await tx.workspaceInvite.deleteMany({ where: { email } });
    if (!appUser) return { invites: invites.count, appUserDeleted: false };

    const userId = appUser.id;
    await tx.task.updateMany({
      where: { assignee_id: userId },
      data: { assignee_id: null },
    });
    await tx.goal.updateMany({ where: { owner_id: userId }, data: { owner_id: null } });
    await tx.activityEvent.updateMany({
      where: { actor_id: userId },
      data: { actor_id: null },
    });
    await tx.space.updateMany({
      where: { owner_id: userId },
      data: { owner_id: auth.prismaUser.id },
    });
    await tx.folder.updateMany({
      where: { owner_id: userId },
      data: { owner_id: auth.prismaUser.id },
    });
    await tx.project.updateMany({
      where: { owner_id: userId },
      data: { owner_id: auth.prismaUser.id },
    });
    await tx.company.updateMany({
      where: { owner_id: userId },
      data: { owner_id: auth.prismaUser.id },
    });

    await tx.notification.deleteMany({ where: { user_id: userId } });
    await tx.calendarEventAttendee.deleteMany({ where: { user_id: userId } });
    await tx.projectMember.deleteMany({ where: { user_id: userId } });
    await tx.savedView.deleteMany({ where: { user_id: userId } });
    await tx.workspaceMember.deleteMany({ where: { user_id: userId } });
    await tx.timeEntry.deleteMany({ where: { user_id: userId } });
    await tx.doc.deleteMany({ where: { author_id: userId } });
    await tx.companyNote.deleteMany({ where: { author_id: userId } });
    await tx.comment.deleteMany({ where: { author_id: userId } });
    await tx.template.deleteMany({ where: { created_by: userId } });
    await tx.recurringTaskRule.deleteMany({ where: { created_by: userId } });
    await tx.automationRule.deleteMany({ where: { created_by: userId } });
    await tx.calendarEvent.deleteMany({ where: { created_by: userId } });

    await tx.user.delete({ where: { id: userId } });
    return { invites: invites.count, appUserDeleted: true };
  });

  return NextResponse.json({
    success: true,
    email,
    app_user_deleted: result.appUserDeleted,
    invites_deleted: result.invites,
    supabase_auth_deleted: authReset.deleted,
    supabase_auth_error: authReset.error,
  });
}

export const POST = withErrorReporting("api:testers/reset:POST", POST_handler);
