import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-response";
import { requireCurrentWorkspace, requireWorkspaceAdmin } from "@/lib/api/scope";
import { buildPage, parsePagination } from "@/lib/pagination";
import { recordActivity } from "@/lib/activity";
import { withErrorReporting } from "@/lib/with-error-reporting";

const GoalStatusSchema = z.enum(["active", "paused", "completed", "archived"]);

const GoalSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional().nullable(),
  status: GoalStatusSchema.optional(),
  target_value: z.number().finite().nonnegative().optional().nullable(),
  current_value: z.number().finite().nonnegative().optional(),
  due_date: z.string().datetime().optional().nullable(),
  owner_id: z.string().uuid().optional().nullable(),
});

async function validateGoalOwner(ownerId: string | null | undefined, workspaceId: string) {
  if (!ownerId) return { ok: true as const, ownerId: null };
  const member = await prisma.workspaceMember.findFirst({
    where: { workspace_id: workspaceId, user_id: ownerId, status: "active" },
    select: { user_id: true },
  });
  if (!member) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Goal owner must be an active member of this workspace" },
        { status: 400 },
      ),
    };
  }
  return { ok: true as const, ownerId: member.user_id };
}

async function GET_handler(req: NextRequest) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  const scope = await requireCurrentWorkspace(auth);
  if (!scope.ok) return scope.response;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const ownerId = searchParams.get("owner_id");
  const { limit, cursor } = parsePagination(req, { defaultLimit: 50, maxLimit: 100 });

  if (status && !GoalStatusSchema.safeParse(status).success) {
    return NextResponse.json({ error: "Invalid goal status" }, { status: 400 });
  }

  const rows = await prisma.goal.findMany({
    where: {
      workspace_id: scope.workspaceId,
      ...(status ? { status } : {}),
      ...(ownerId ? { owner_id: ownerId } : {}),
    },
    take: limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    orderBy: [{ updated_at: "desc" }, { id: "asc" }],
    include: { owner: { select: { id: true, name: true, email: true } } },
  });

  return NextResponse.json(buildPage(rows, limit));
}

async function POST_handler(req: NextRequest) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  const scope = await requireCurrentWorkspace(auth);
  if (!scope.ok) return scope.response;
  const admin = requireWorkspaceAdmin(auth, scope.workspaceId);
  if (!admin.ok) return admin.response;

  const parsed = GoalSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid goal", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const requestedOwnerId = parsed.data.owner_id ?? auth.prismaUser.id;
  const owner = await validateGoalOwner(requestedOwnerId, scope.workspaceId);
  if (!owner.ok) return owner.response;

  const goal = await prisma.goal.create({
    data: {
      workspace_id: scope.workspaceId,
      name: parsed.data.name,
      description: parsed.data.description || null,
      status: parsed.data.status ?? "active",
      target_value: parsed.data.target_value ?? null,
      current_value: parsed.data.current_value ?? 0,
      due_date: parsed.data.due_date ? new Date(parsed.data.due_date) : null,
      owner_id: owner.ownerId,
    },
    include: { owner: { select: { id: true, name: true, email: true } } },
  });

  await recordActivity({
    workspace_id: scope.workspaceId,
    actor_id: auth.prismaUser.id,
    type: "goal_created",
    entity_type: "goal",
    entity_id: goal.id,
    metadata: { name: goal.name, status: goal.status, owner_id: goal.owner_id },
  });

  return NextResponse.json(goal, { status: 201 });
}

export const GET = withErrorReporting("api:goals:GET", GET_handler);
export const POST = withErrorReporting("api:goals:POST", POST_handler);
