import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-response";
import { isWorkspaceAdminFor } from "@/lib/auth-helpers";
import { recordActivity } from "@/lib/activity";
import { withErrorReporting } from "@/lib/with-error-reporting";

const UpdateContactSchema = z.object({
  name: z.string().trim().min(1).optional(),
  email: z.string().trim().email().nullable().optional(),
  phone: z.string().trim().nullable().optional(),
  role: z.string().trim().nullable().optional(),
});

async function getScopedContact(companyId: string, contactId: string, workspaceId: string) {
  return prisma.companyContact.findFirst({
    where: {
      id: contactId,
      company_id: companyId,
      workspace_id: workspaceId,
    },
    include: { company: { select: { id: true, name: true, owner_id: true, workspace_id: true } } },
  });
}

async function PATCH_handler(
  req: NextRequest,
  { params }: { params: { id: string; contactId: string } },
) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  if (!auth.currentWorkspaceId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const contact = await getScopedContact(params.id, params.contactId, auth.currentWorkspaceId);
  if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (contact.company.owner_id !== auth.prismaUser.id && !isWorkspaceAdminFor(auth, contact.workspace_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = UpdateContactSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid contact", issues: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await prisma.companyContact.update({
    where: { id: contact.id },
    data: parsed.data,
  });

  await recordActivity({
    workspace_id: contact.workspace_id,
    actor_id: auth.prismaUser.id,
    type: "company_contact_updated",
    entity_type: "company_contact",
    entity_id: contact.id,
    company_id: contact.company_id,
    metadata: { company_name: contact.company.name, contact_name: updated.name },
  });

  return NextResponse.json(updated);
}

async function DELETE_handler(
  req: NextRequest,
  { params }: { params: { id: string; contactId: string } },
) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  void req;
  if (!auth.currentWorkspaceId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const contact = await getScopedContact(params.id, params.contactId, auth.currentWorkspaceId);
  if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (contact.company.owner_id !== auth.prismaUser.id && !isWorkspaceAdminFor(auth, contact.workspace_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.companyContact.delete({ where: { id: contact.id } });

  await recordActivity({
    workspace_id: contact.workspace_id,
    actor_id: auth.prismaUser.id,
    type: "company_contact_deleted",
    entity_type: "company_contact",
    entity_id: contact.id,
    company_id: contact.company_id,
    metadata: { company_name: contact.company.name, contact_name: contact.name },
  });

  return NextResponse.json({ success: true });
}

export const PATCH = withErrorReporting("api:companies/id/contacts/contactId:PATCH", PATCH_handler);
export const DELETE = withErrorReporting("api:companies/id/contacts/contactId:DELETE", DELETE_handler);
