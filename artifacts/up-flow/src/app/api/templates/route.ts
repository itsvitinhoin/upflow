import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-response";
import { recordActivity } from "@/lib/activity";
import { builtInTemplates } from "@/lib/templates";
import { withErrorReporting } from "@/lib/with-error-reporting";

const TemplateSchema = z.object({
  name: z.string().trim().min(1),
  type: z.string().trim().min(1),
  description: z.string().trim().optional().nullable(),
  config: z.unknown(),
});

async function GET_handler() {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  if (!auth.currentWorkspaceId) {
    return NextResponse.json({ items: builtInTemplates, saved: [] });
  }

  const saved = await prisma.template.findMany({
    where: { workspace_id: auth.currentWorkspaceId, active: true },
    orderBy: [{ created_at: "desc" }, { id: "asc" }],
  });
  return NextResponse.json({ items: builtInTemplates, saved });
}

async function POST_handler(req: NextRequest) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  if (!auth.currentWorkspaceId) {
    return NextResponse.json({ error: "No active workspace" }, { status: 400 });
  }

  const parsed = TemplateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid template", issues: parsed.error.flatten() }, { status: 400 });
  }

  const template = await prisma.template.create({
    data: {
      workspace_id: auth.currentWorkspaceId,
      created_by: auth.prismaUser.id,
      name: parsed.data.name,
      type: parsed.data.type,
      description: parsed.data.description || null,
      config: parsed.data.config as never,
    },
  });

  await recordActivity({
    workspace_id: auth.currentWorkspaceId,
    actor_id: auth.prismaUser.id,
    type: "template_created",
    entity_type: "template",
    entity_id: template.id,
    metadata: { name: template.name },
  });

  return NextResponse.json(template, { status: 201 });
}

export const GET = withErrorReporting("api:templates:GET", GET_handler);
export const POST = withErrorReporting("api:templates:POST", POST_handler);
