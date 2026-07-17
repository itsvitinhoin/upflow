import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  canAccessWorkspace,
  isWorkspaceAdminFor,
} from "@/lib/auth-helpers";
import { requireAuth } from "@/lib/auth-response";
import { withErrorReporting } from "@/lib/with-error-reporting";
import { parseAppDate } from "@/lib/utils";
import { canReadProject } from "@/lib/project-access";
import { deleteProjectsByIds } from "@/lib/project-delete";
import { z } from "zod";

const UpdateProjectSchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().nullable().optional(),
  status: z.enum(["active", "archived"]).optional(),
  due_date: z.string().nullable().optional(),
  space_id: z.string().uuid().nullable().optional(),
  folder_id: z.string().uuid().nullable().optional(),
  company_id: z.string().uuid().nullable().optional(),
  onboarding_enabled: z.boolean().optional(),
  closing_date: z.string().nullable().optional(),
  onboarding_start_date: z.string().nullable().optional(),
  responsible_salesperson_id: z.string().uuid().nullable().optional(),
  initial_notes: z.string().nullable().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

function parsePatchDate(value: string | null | undefined) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  return parseAppDate(value);
}

async function GET_handler(
  req: NextRequest,
  { params }: RouteContext,
) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  void req;
  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      space: { select: { id: true, name: true, icon: true } },
      _count: { select: { tasks: true, docs: true } },
    },
  });

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canReadProject(auth, project))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json(project);
}

async function PATCH_handler(
  req: NextRequest,
  { params }: RouteContext,
) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    select: { id: true, workspace_id: true, company_id: true },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canAccessWorkspace(auth, project.workspace_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!isWorkspaceAdminFor(auth, project.workspace_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = UpdateProjectSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid project", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const body = parsed.data;
  const {
    name,
    description,
    status,
    due_date,
    space_id,
    folder_id,
    company_id,
    onboarding_enabled,
    closing_date,
    onboarding_start_date,
    responsible_salesperson_id,
    initial_notes,
  } = body;
  const parsedDueDate = parsePatchDate(due_date);
  const parsedClosingDate = parsePatchDate(closing_date);
  const parsedOnboardingStartDate = parsePatchDate(onboarding_start_date);
  if (parsedDueDate === "invalid") {
    return NextResponse.json({ error: "Invalid due_date" }, { status: 400 });
  }
  if (parsedClosingDate === "invalid" || parsedOnboardingStartDate === "invalid") {
    return NextResponse.json({ error: "Invalid onboarding date" }, { status: 400 });
  }

  const result = await prisma.$transaction(async (tx) => {
    // Match the Company -> Project lock order used by onboarding and client
    // deletion. The company lock also keeps an explicit reassignment target
    // alive until the project update commits.
    const companyToLock = company_id === undefined ? project.company_id : company_id;
    if (companyToLock) {
      const lockedCompany = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "Company"
        WHERE "id" = ${companyToLock} AND "workspace_id" = ${project.workspace_id}
        FOR KEY SHARE
      `;
      if (company_id && lockedCompany.length === 0) {
        return { ok: false as const, status: 400, error: "Company not found" };
      }
    }

    // Lock the row before reading workflow evidence so concurrent onboarding
    // and client lifecycle mutations cannot make the classification stale.
    await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${id} FOR UPDATE`;
    const current = await tx.project.findUnique({
      where: { id },
      include: {
        client_onboarding: { select: { id: true } },
        _count: {
          select: {
            marketing_b2b_onboarding_forms: true,
            marketing_b2c_onboarding_forms: true,
            tasks: { where: { onboarding_items: { some: {} } } },
          },
        },
      },
    });
    if (!current) return { ok: false as const, status: 404, error: "Not found" };

    if (space_id) {
      const space = await tx.space.findUnique({ where: { id: space_id } });
      if (!space) return { ok: false as const, status: 400, error: "Space not found" };
      if (space.workspace_id !== current.workspace_id) {
        return { ok: false as const, status: 400, error: "Cannot move across workspaces" };
      }
    }
    if (folder_id) {
      const folder = await tx.folder.findUnique({ where: { id: folder_id } });
      if (!folder) return { ok: false as const, status: 400, error: "Folder not found" };
      if (folder.workspace_id !== current.workspace_id) {
        return { ok: false as const, status: 400, error: "Cannot move across workspaces" };
      }
      const targetSpaceId = space_id ?? current.space_id;
      if (targetSpaceId && folder.space_id !== targetSpaceId) {
        return {
          ok: false as const,
          status: 400,
          error: "Folder does not belong to selected space",
        };
      }
    }
    const hasOnboardingWorkflow = Boolean(
      current.client_onboarding ||
        current._count.marketing_b2b_onboarding_forms > 0 ||
        current._count.marketing_b2c_onboarding_forms > 0 ||
        current._count.tasks > 0,
    );
    if (
      hasOnboardingWorkflow &&
      company_id !== undefined &&
      company_id !== current.company_id
    ) {
      return {
        ok: false as const,
        status: 409,
        error: "The client cannot be changed while this project has onboarding records",
      };
    }
    const effectiveCompanyId = company_id !== undefined ? company_id : current.company_id;
    const nextKind = current.kind === "operational_queue"
      ? undefined
      : hasOnboardingWorkflow
        ? "onboarding"
        : effectiveCompanyId
          ? "client"
          : "internal";

    const updated = await tx.project.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(status !== undefined && { status }),
        ...(parsedDueDate !== undefined && { due_date: parsedDueDate }),
        ...(onboarding_enabled !== undefined && { onboarding_enabled }),
        ...(parsedClosingDate !== undefined && { closing_date: parsedClosingDate }),
        ...(parsedOnboardingStartDate !== undefined && { onboarding_start_date: parsedOnboardingStartDate }),
        ...(responsible_salesperson_id !== undefined && { responsible_salesperson_id: responsible_salesperson_id || null }),
        ...(initial_notes !== undefined && { initial_notes }),
        ...(space_id !== undefined && { space_id: space_id || null }),
        ...(folder_id !== undefined && { folder_id: folder_id || null }),
        ...(company_id !== undefined && { company_id: company_id || null }),
        ...(nextKind !== undefined && { kind: nextKind }),
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        space: { select: { id: true, name: true, icon: true } },
        folder: { select: { id: true, name: true, icon: true } },
        _count: { select: { tasks: true } },
      },
    });

    await tx.activityEvent.create({
      data: {
        workspace_id: current.workspace_id,
        actor_id: auth.prismaUser.id,
        type: "project_updated",
        entity_type: "project",
        entity_id: updated.id,
        project_id: updated.id,
        metadata: { name: updated.name, status: updated.status },
      },
    });

    return { ok: true as const, updated };
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.updated);
}

async function DELETE_handler(
  req: NextRequest,
  { params }: RouteContext,
) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  void req;
  const { id } = await params;

  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canAccessWorkspace(auth, project.workspace_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!isWorkspaceAdminFor(auth, project.workspace_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const deleted = await deleteProjectsByIds(tx, [project]);

    if (deleted.projects !== 1) {
      throw new Error("Project delete did not remove the project row");
    }

    await tx.activityEvent.create({
      data: {
        workspace_id: project.workspace_id,
        actor_id: auth.prismaUser.id,
        type: "project_deleted",
        entity_type: "project",
        entity_id: project.id,
        metadata: { name: project.name, deleted: { ...deleted } },
      },
    });

    return deleted;
  });

  return NextResponse.json({ success: true, deleted: result });
}
export const GET = withErrorReporting("api:projects/id:GET", GET_handler);
export const PATCH = withErrorReporting("api:projects/id:PATCH", PATCH_handler);
export const DELETE = withErrorReporting("api:projects/id:DELETE", DELETE_handler);
