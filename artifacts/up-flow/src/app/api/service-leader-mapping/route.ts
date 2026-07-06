import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-response";
import { isWorkspaceAdminFor } from "@/lib/auth-helpers";
import { onboardingDepartmentOwnerLabels } from "@/lib/onboarding-department-owners";
import { withErrorReporting } from "@/lib/with-error-reporting";

const departmentLabels = onboardingDepartmentOwnerLabels();
const departmentLabelSet = new Set(departmentLabels.map((label) => label.toLowerCase()));

const MappingSchema = z.object({
  mappings: z.array(z.object({
    service: z.string().trim().min(1),
    leader_id: z.string().trim().nullable().optional(),
    backup_leader_id: z.string().trim().nullable().optional(),
    department_id: z.string().trim().nullable().optional(),
    active: z.boolean().optional(),
  })).min(1),
});

function sortDepartmentMappings<T extends { service: string }>(rows: T[]) {
  const order = new Map(departmentLabels.map((label, index) => [label.toLowerCase(), index]));
  return [...rows].sort((a, b) => (order.get(a.service.toLowerCase()) ?? 999) - (order.get(b.service.toLowerCase()) ?? 999));
}

async function loadMappings(workspaceId: string) {
  const rows = await prisma.serviceLeaderMapping.findMany({
    where: { workspace_id: workspaceId, service: { in: departmentLabels } },
    orderBy: [{ service: "asc" }, { id: "asc" }],
    include: {
      leader: { select: { id: true, name: true, email: true } },
      backup_leader: { select: { id: true, name: true, email: true } },
      department: { select: { id: true, name: true } },
    },
  });
  const existing = new Set(rows.map((row) => row.service.toLowerCase()));
  const defaults = departmentLabels
    .filter((service) => !existing.has(service.toLowerCase()))
    .map((service) => ({
      id: `default:${service}`,
      workspace_id: workspaceId,
      service,
      leader_id: null,
      backup_leader_id: null,
      department_id: null,
      active: true,
      leader: null,
      backup_leader: null,
      department: null,
    }));
  return sortDepartmentMappings([...rows, ...defaults]);
}

async function assertWorkspaceMember(workspaceId: string, userId: string, label: string) {
  const member = await prisma.workspaceMember.findFirst({
    where: {
      workspace_id: workspaceId,
      user_id: userId,
      status: "active",
      role: { not: "guest" },
    },
    select: { id: true },
  });
  if (!member) {
    return `${label}: selected user is not an active workspace member`;
  }
  return null;
}

async function GET_handler(req: NextRequest) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  void req;
  if (!auth.currentWorkspaceId) return NextResponse.json({ items: [] });
  return NextResponse.json({ items: await loadMappings(auth.currentWorkspaceId) });
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
    if (!departmentLabelSet.has(mapping.service.toLowerCase())) {
      return NextResponse.json({ error: `${mapping.service}: onboarding ownership must be mapped by department` }, { status: 400 });
    }
    if (mapping.leader_id) {
      const error = await assertWorkspaceMember(auth.currentWorkspaceId, mapping.leader_id, mapping.service);
      if (error) return NextResponse.json({ error }, { status: 400 });
    }
    if (mapping.backup_leader_id) {
      const error = await assertWorkspaceMember(auth.currentWorkspaceId, mapping.backup_leader_id, mapping.service);
      if (error) return NextResponse.json({ error }, { status: 400 });
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
          backup_leader_id: mapping.backup_leader_id ?? null,
          department_id: mapping.department_id ?? null,
          active: mapping.active ?? true,
        },
        update: {
          leader_id: mapping.leader_id ?? null,
          backup_leader_id: mapping.backup_leader_id ?? null,
          department_id: mapping.department_id ?? null,
          active: mapping.active ?? true,
        },
      }),
    ),
  );

  return NextResponse.json({ items: await loadMappings(auth.currentWorkspaceId) });
}

export const GET = withErrorReporting("api:service-leader-mapping:GET", GET_handler);
export const PATCH = withErrorReporting("api:service-leader-mapping:PATCH", PATCH_handler);
