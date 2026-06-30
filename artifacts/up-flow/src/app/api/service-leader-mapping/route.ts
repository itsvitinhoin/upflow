import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-response";
import { isWorkspaceAdminFor } from "@/lib/auth-helpers";
import { DEFAULT_ONBOARDING_SERVICES } from "@/lib/onboarding";
import { withErrorReporting } from "@/lib/with-error-reporting";

const MappingSchema = z.object({
  mappings: z.array(z.object({
    service: z.string().trim().min(1),
    leader_id: z.string().trim().nullable().optional(),
    department_id: z.string().trim().nullable().optional(),
    active: z.boolean().optional(),
  })).min(1),
});

async function GET_handler(req: NextRequest) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  void req;
  if (!auth.currentWorkspaceId) return NextResponse.json({ items: [] });
  const rows = await prisma.serviceLeaderMapping.findMany({
    where: { workspace_id: auth.currentWorkspaceId },
    orderBy: [{ service: "asc" }, { id: "asc" }],
    include: {
      leader: { select: { id: true, name: true, email: true } },
      department: { select: { id: true, name: true } },
    },
  });
  const existing = new Set(rows.map((row) => row.service.toLowerCase()));
  const defaults = DEFAULT_ONBOARDING_SERVICES
    .filter((service) => !existing.has(service.toLowerCase()))
    .map((service) => ({
      id: `default:${service}`,
      workspace_id: auth.currentWorkspaceId,
      service,
      leader_id: null,
      department_id: null,
      active: true,
      leader: null,
      department: null,
    }));
  return NextResponse.json({ items: [...rows, ...defaults] });
}

async function PATCH_handler(req: NextRequest) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  if (!auth.currentWorkspaceId) {
    return NextResponse.json({ error: "No active workspace" }, { status: 400 });
  }
  if (!isWorkspaceAdminFor(auth, auth.currentWorkspaceId)) {
    return NextResponse.json({ error: "Workspace admin access required" }, { status: 403 });
  }
  const parsed = MappingSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid mapping", issues: parsed.error.flatten() }, { status: 400 });
  }

  for (const mapping of parsed.data.mappings) {
    if (mapping.leader_id) {
      const member = await prisma.workspaceMember.findFirst({
        where: {
          workspace_id: auth.currentWorkspaceId,
          user_id: mapping.leader_id,
          status: "active",
          role: { not: "guest" },
        },
        select: { id: true },
      });
      if (!member) {
        return NextResponse.json({ error: `${mapping.service}: selected leader is not an active workspace member` }, { status: 400 });
      }
    }
    if (mapping.department_id) {
      const department = await prisma.department.findFirst({
        where: { id: mapping.department_id, workspace_id: auth.currentWorkspaceId },
        select: { id: true },
      });
      if (!department) {
        return NextResponse.json({ error: `${mapping.service}: selected department does not belong to this workspace` }, { status: 400 });
      }
    }
  }

  await prisma.$transaction(
    parsed.data.mappings.map((mapping) =>
      prisma.serviceLeaderMapping.upsert({
        where: {
          workspace_id_service: {
            workspace_id: auth.currentWorkspaceId,
            service: mapping.service,
          },
        },
        create: {
          workspace_id: auth.currentWorkspaceId,
          service: mapping.service,
          leader_id: mapping.leader_id ?? null,
          department_id: mapping.department_id ?? null,
          active: mapping.active ?? true,
        },
        update: {
          leader_id: mapping.leader_id ?? null,
          department_id: mapping.department_id ?? null,
          active: mapping.active ?? true,
        },
      }),
    ),
  );

  const rows = await prisma.serviceLeaderMapping.findMany({
    where: { workspace_id: auth.currentWorkspaceId },
    orderBy: [{ service: "asc" }, { id: "asc" }],
    include: {
      leader: { select: { id: true, name: true, email: true } },
      department: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json({ items: rows });
}

export const GET = withErrorReporting("api:service-leader-mapping:GET", GET_handler);
export const PATCH = withErrorReporting("api:service-leader-mapping:PATCH", PATCH_handler);
