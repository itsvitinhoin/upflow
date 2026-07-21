import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { canAccessWorkspace, isWorkspaceAdminFor } from "@/lib/auth-helpers";
import { requireAuth } from "@/lib/auth-response";
import { isCreativeDesignDepartmentName } from "@/lib/creative-briefing";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { withErrorReporting } from "@/lib/with-error-reporting";

const bodySchema = z.object({
  user_ids: z.array(z.string().uuid()).min(1).max(500),
});

type RouteContext = { params: Promise<{ id: string }> };

async function GET_handler(_req: NextRequest, { params }: RouteContext) {
  const { id: workspaceId } = await params;
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;

  if (!canAccessWorkspace(auth, workspaceId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    can_manage: isWorkspaceAdminFor(auth, workspaceId),
  });
}

async function POST_handler(req: NextRequest, { params }: RouteContext) {
  const { id: workspaceId } = await params;
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;

  if (!isWorkspaceAdminFor(auth, workspaceId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rateLimit = await checkRateLimit(req, {
    key: "creative-designer-roster",
    windowMs: 60_000,
    max: 10,
  });
  if (!rateLimit.ok) return rateLimitResponse(rateLimit);

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid designer selection" },
      { status: 400 },
    );
  }

  const userIds = [...new Set(parsed.data.user_ids)];
  const result = await prisma.$transaction(async (tx) => {
    const activeMemberships = await tx.workspaceMember.findMany({
      where: {
        workspace_id: workspaceId,
        user_id: { in: userIds },
        status: "active",
      },
      select: { user_id: true },
    });
    if (activeMemberships.length !== userIds.length) return null;

    const departments = await tx.department.findMany({
      where: { workspace_id: workspaceId },
      select: { id: true, name: true },
    });
    let department = departments.find((item) =>
      isCreativeDesignDepartmentName(item.name),
    );

    if (!department) {
      const lastDepartment = await tx.department.findFirst({
        where: { workspace_id: workspaceId },
        orderBy: { sort_order: "desc" },
        select: { sort_order: true },
      });
      department = await tx.department.create({
        data: {
          workspace_id: workspaceId,
          name: "Creative & Design",
          color: "violet",
          sort_order: (lastDepartment?.sort_order ?? -1) + 1,
        },
        select: { id: true, name: true },
      });
    }

    const updated = await tx.workspaceMember.updateMany({
      where: {
        workspace_id: workspaceId,
        user_id: { in: userIds },
        status: "active",
      },
      data: { department_id: department.id },
    });

    return {
      department,
      member_ids: userIds,
      updated_count: updated.count,
    };
  });

  if (!result) {
    return NextResponse.json(
      {
        error: "One or more selected members are not active in this workspace",
      },
      { status: 400 },
    );
  }

  return NextResponse.json(result);
}

export const POST = withErrorReporting(
  "api:workspaces/creative-designers:POST",
  POST_handler,
);

export const GET = withErrorReporting(
  "api:workspaces/creative-designers:GET",
  GET_handler,
);
