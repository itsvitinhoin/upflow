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
    backup_leader_ids: z.array(z.string().trim().min(1)).max(50).optional(),
    backup_leader_id: z.string().trim().nullable().optional(),
    department_id: z.string().trim().nullable().optional(),
    active: z.boolean().optional(),
  })).min(1),
});

type MappingInput = z.infer<typeof MappingSchema>["mappings"][number];

function backupOwnerIdsForInput(mapping: MappingInput) {
  return mapping.backup_leader_ids ?? (mapping.backup_leader_id ? [mapping.backup_leader_id] : []);
}

function sortDepartmentMappings<T extends { service: string }>(rows: T[]) {
  const order = new Map(departmentLabels.map((label, index) => [label.toLowerCase(), index]));
  return [...rows].sort((a, b) => (order.get(a.service.toLowerCase()) ?? 999) - (order.get(b.service.toLowerCase()) ?? 999));
}

function backupOwnersFor(
  ownerLinks: Array<{ user: { id: string; name: string; email: string } }>,
  legacyOwner: { id: string; name: string; email: string } | null,
) {
  const ownersById = new Map(ownerLinks.map(({ user }) => [user.id, user]));
  if (legacyOwner) ownersById.set(legacyOwner.id, legacyOwner);
  return [...ownersById.values()].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

async function loadMappings(workspaceId: string) {
  const rows = await prisma.serviceLeaderMapping.findMany({
    where: { workspace_id: workspaceId, service: { in: departmentLabels } },
    orderBy: [{ service: "asc" }, { id: "asc" }],
    include: {
      leader: { select: { id: true, name: true, email: true } },
      backup_leader: { select: { id: true, name: true, email: true } },
      backup_owners: {
        orderBy: [{ created_at: "asc" }, { user_id: "asc" }],
        select: { user: { select: { id: true, name: true, email: true } } },
      },
      department: { select: { id: true, name: true } },
    },
  });
  const items = rows.map(({ backup_owners, ...row }) => {
    const owners = backupOwnersFor(backup_owners, row.backup_leader);
    return {
      ...row,
      backup_owners: owners,
      backup_leader_ids: owners.map((owner) => owner.id),
    };
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
      backup_leader_ids: [],
      department_id: null,
      active: true,
      leader: null,
      backup_leader: null,
      backup_owners: [],
      department: null,
    }));
  return sortDepartmentMappings([...items, ...defaults]);
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

  const mappings = parsed.data.mappings.map((mapping) => ({
    ...mapping,
    backup_leader_ids: backupOwnerIdsForInput(mapping),
    uses_legacy_backup_leader: mapping.backup_leader_ids === undefined,
  }));

  for (const mapping of mappings) {
    if (!departmentLabelSet.has(mapping.service.toLowerCase())) {
      return NextResponse.json({ error: `${mapping.service}: onboarding ownership must be mapped by department` }, { status: 400 });
    }
    if (mapping.leader_id) {
      const error = await assertWorkspaceMember(auth.currentWorkspaceId, mapping.leader_id, mapping.service);
      if (error) return NextResponse.json({ error }, { status: 400 });
    }
    if (new Set(mapping.backup_leader_ids).size !== mapping.backup_leader_ids.length) {
      return NextResponse.json({ error: `${mapping.service}: duplicate backup owners are not allowed` }, { status: 400 });
    }
    if (mapping.leader_id && mapping.backup_leader_ids.includes(mapping.leader_id)) {
      return NextResponse.json({ error: `${mapping.service}: primary responsible cannot also be a backup owner` }, { status: 400 });
    }
    for (const backupOwnerId of mapping.backup_leader_ids) {
      const error = await assertWorkspaceMember(auth.currentWorkspaceId, backupOwnerId, mapping.service);
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

  await prisma.$transaction(async (tx) => {
    for (const mapping of mappings) {
      const existingMapping = mapping.uses_legacy_backup_leader
        ? await tx.serviceLeaderMapping.findUnique({
          where: {
            workspace_id_service: {
              workspace_id: auth.currentWorkspaceId,
              service: mapping.service,
            },
          },
          select: {
            backup_leader_id: true,
            backup_owners: { select: { user_id: true } },
          },
        })
        : null;
      const preserveLegacyBackupOwners = Boolean(
        existingMapping
        && (mapping.backup_leader_id === undefined
          || mapping.backup_leader_id === existingMapping.backup_leader_id),
      );
      let backupLeaderIds = preserveLegacyBackupOwners
        ? existingMapping?.backup_owners.map((owner) => owner.user_id) ?? []
        : mapping.backup_leader_ids;
      if (preserveLegacyBackupOwners && backupLeaderIds.length === 0 && existingMapping?.backup_leader_id) {
        backupLeaderIds = [existingMapping.backup_leader_id];
      }
      if (preserveLegacyBackupOwners && mapping.leader_id) {
        backupLeaderIds = backupLeaderIds.filter((userId) => userId !== mapping.leader_id);
      }
      const backup_leader_id = backupLeaderIds[0] ?? null;
      const savedMapping = await tx.serviceLeaderMapping.upsert({
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
          backup_leader_id,
          department_id: mapping.department_id ?? null,
          active: mapping.active ?? true,
        },
        update: {
          leader_id: mapping.leader_id ?? null,
          backup_leader_id,
          department_id: mapping.department_id ?? null,
          active: mapping.active ?? true,
        },
      });

      await tx.serviceLeaderMappingBackupOwner.deleteMany({
        where: { mapping_id: savedMapping.id },
      });
      if (backupLeaderIds.length > 0) {
        await tx.serviceLeaderMappingBackupOwner.createMany({
          data: backupLeaderIds.map((user_id) => ({
            mapping_id: savedMapping.id,
            user_id,
          })),
        });
      }
    }
  });

  return NextResponse.json({ items: await loadMappings(auth.currentWorkspaceId) });
}

export const GET = withErrorReporting("api:service-leader-mapping:GET", GET_handler);
export const PATCH = withErrorReporting("api:service-leader-mapping:PATCH", PATCH_handler);
