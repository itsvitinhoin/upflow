import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-response";
import { recordActivity } from "@/lib/activity";
import { canManageProjectMembers, canReadProject } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import { withErrorReporting } from "@/lib/with-error-reporting";

const UserIdSchema = z.string().uuid();

type RouteContext = { params: Promise<{ id: string; userId: string }> };

async function DELETE_handler(req: NextRequest, { params }: RouteContext) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  void req;
  const { id, userId } = await params;

  const parsedUserId = UserIdSchema.safeParse(userId);
  if (!parsedUserId.success) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  const project = await prisma.project.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      workspace_id: true,
      owner_id: true,
    },
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!(await canReadProject(auth, project))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!canManageProjectMembers(auth, project)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (project.owner_id === parsedUserId.data) {
    return NextResponse.json(
      { error: "The project owner cannot be removed" },
      { status: 400 },
    );
  }

  const member = await prisma.projectMember.findUnique({
    where: {
      project_id_user_id: {
        project_id: project.id,
        user_id: parsedUserId.data,
      },
    },
    select: {
      id: true,
      user_id: true,
      user: { select: { name: true, email: true } },
    },
  });
  if (!member) {
    return NextResponse.json({ error: "Project member not found" }, { status: 404 });
  }

  // Removing a stale project member is intentionally allowed even when the
  // workspace membership is now inactive or guest. POST is the path that
  // enforces active, non-guest workspace membership before adding access.
  const deleted = await prisma.projectMember.deleteMany({
    where: {
      project_id: project.id,
      user_id: parsedUserId.data,
    },
  });
  if (deleted.count === 0) {
    return NextResponse.json({ error: "Project member not found" }, { status: 404 });
  }

  await recordActivity({
    workspace_id: project.workspace_id,
    project_id: project.id,
    actor_id: auth.prismaUser.id,
    type: "project_member_removed",
    entity_type: "project_member",
    entity_id: member.id,
    metadata: {
      project_name: project.name,
      user_id: member.user_id,
      name: member.user.name,
      email: member.user.email,
    },
  });

  return NextResponse.json({ success: true });
}

export const DELETE = withErrorReporting(
  "api:projects:members:user:DELETE",
  DELETE_handler,
);
