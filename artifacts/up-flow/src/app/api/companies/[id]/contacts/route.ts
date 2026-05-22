import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-response";
import { recordActivity } from "@/lib/activity";
import { withErrorReporting } from "@/lib/with-error-reporting";

const ContactSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  role: z.string().trim().optional().nullable(),
});

async function POST_handler(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  if (!auth.currentWorkspaceId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const company = await prisma.company.findFirst({
    where: { id: params.id, workspace_id: auth.currentWorkspaceId },
  });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = ContactSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid contact", issues: parsed.error.flatten() }, { status: 400 });
  }

  const contact = await prisma.companyContact.create({
    data: {
      workspace_id: company.workspace_id,
      company_id: company.id,
      name: parsed.data.name,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      role: parsed.data.role || null,
    },
  });

  await recordActivity({
    workspace_id: company.workspace_id,
    actor_id: auth.prismaUser.id,
    type: "company_contact_created",
    entity_type: "company_contact",
    entity_id: contact.id,
    company_id: company.id,
    metadata: { company_name: company.name, contact_name: contact.name },
  });

  return NextResponse.json(contact, { status: 201 });
}

export const POST = withErrorReporting("api:companies/id/contacts:POST", POST_handler);
