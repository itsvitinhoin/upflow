import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-response";
import { recordActivity } from "@/lib/activity";
import { canManageProjectMembers, canReadProject } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import { withErrorReporting } from "@/lib/with-error-reporting";

const AddProjectMemberSchema = z.object({
  user_id: z.string().uuid(),
});

type RouteContext = { params: Promise<{ id: string }> };

type ProjectTarget = {
  id: string;
  name: string;
  workspace_id: string;
  owner_id: string | null;
};

const projectMemberUserSelect = {
  id: true,
  name: true,
  email: true,
} as const;

async function findProject(projectId: string) {
  return prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      workspace_id: true,
      owner_id: true,
    },
  });
}

async function findProjectMember(projectId: string, userId: string) {
  return prisma.projectMember.findUnique({
    where: {
      project_id_user_id: {
        project_id: projectId,
        user_id: userId,
      },
    },
    select: {
      user_id: true,
      role: true,
      user: { select: projectMemberUserSelect },
    },
  });
}

function memberResponse(member: {
  user_id: string;
  role: string;
  user: { id: string; name: string; email: string };
}) {
  return {
    user_id: member.user_id,
    role: member.role,
    user: member.user,
  };
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

async function GET_handler(req: NextRequest, { params }: RouteContext) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  void req;
  const { id } = await params;

  const project = await findProject(id);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!(await canReadProject(auth, project))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const canManageMembers = canManageProjectMembers(auth, project);
  const [members, eligibleMembers] = await Promise.all([
    prisma.projectMember.findMany({
      where: { project_id: project.id },
      select: {
        user_id: true,
        role: true,
        user: { select: projectMemberUserSelect },
      },
      orderBy: { created_at: "asc" },
    }),
    canManageMembers
      ? prisma.workspaceMember.findMany({
          where: {
            workspace_id: project.workspace_id,
            status: "active",
            role: { not: "guest" },
          },
          select: {
            user_id: true,
            role: true,
            user: { select: projectMemberUserSelect },
          },
          orderBy: { created_at: "asc" },
        })
      : Promise.resolve([]),
  ]);

  return NextResponse.json({
    canManageMembers,
    project: {
      id: project.id,
      name: project.name,
      owner_id: project.owner_id,
    },
    members: members.map(memberResponse),
    eligibleMembers: eligibleMembers
      .map((membership) => ({
        id: membership.user.id,
        name: membership.user.name,
        email: membership.user.email,
        role: membership.role,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  });
}

async function POST_handler(req: NextRequest, { params }: RouteContext) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  const { id } = await params;

  const project = await findProject(id);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!(await canReadProject(auth, project))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!canManageProjectMembers(auth, project)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = AddProjectMemberSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid project member", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (project.owner_id === parsed.data.user_id) {
    return NextResponse.json(
      { error: "The project owner already has project access" },
      { status: 400 },
    );
  }

  const eligibleMembership = await prisma.workspaceMember.findFirst({
    where: {
      workspace_id: project.workspace_id,
      user_id: parsed.data.user_id,
      status: "active",
      role: { not: "guest" },
    },
    select: {
      user_id: true,
      user: { select: projectMemberUserSelect },
    },
  });
  if (!eligibleMembership) {
    return NextResponse.json(
      { error: "User must be an active, non-guest member of this workspace" },
      { status: 400 },
    );
  }

  const existing = await findProjectMember(project.id, parsed.data.user_id);
  if (existing) {
    return NextResponse.json({ member: memberResponse(existing), created: false });
  }

  let member;
  try {
    member = await prisma.projectMember.create({
      data: {
        project_id: project.id,
        user_id: eligibleMembership.user_id,
      },
      select: {
        id: true,
        user_id: true,
        role: true,
        user: { select: projectMemberUserSelect },
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const concurrentMember = await findProjectMember(project.id, parsed.data.user_id);
      if (concurrentMember) {
        return NextResponse.json({
          member: memberResponse(concurrentMember),
          created: false,
        });
      }
    }
    throw error;
  }

  await recordActivity({
    workspace_id: project.workspace_id,
    project_id: project.id,
    actor_id: auth.prismaUser.id,
    type: "project_member_added",
    entity_type: "project_member",
    entity_id: member.id,
    metadata: {
      project_name: project.name,
      user_id: member.user_id,
      name: member.user.name,
      email: member.user.email,
    },
  });

  return NextResponse.json(
    { member: memberResponse(member), created: true },
    { status: 201 },
  );
}

export const GET = withErrorReporting("api:projects:members:GET", GET_handler);
export const POST = withErrorReporting("api:projects:members:POST", POST_handler);
