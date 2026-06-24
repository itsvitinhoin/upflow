import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isWorkspaceAdminFor } from "@/lib/auth-helpers";
import { requireAuth } from "@/lib/auth-response";
import { recordActivity } from "@/lib/activity";
import { builtInTemplates, type BuiltInTemplate } from "@/lib/templates";
import { withErrorReporting } from "@/lib/with-error-reporting";

const ApplyTemplateSchema = z.object({
  name: z.string().trim().optional(),
  space_id: z.string().uuid().optional().nullable(),
  folder_id: z.string().uuid().optional().nullable(),
  company_id: z.string().uuid().optional().nullable(),
});

function normalizeTemplate(template: { id: string; name: string; config: unknown }): BuiltInTemplate | null {
  const config = template.config as BuiltInTemplate["config"];
  if (!config || !Array.isArray(config.tasks) || typeof config.projectName !== "string") return null;
  return {
    id: template.id,
    name: template.name,
    type: "custom",
    description: "",
    config,
  };
}

async function POST_handler(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  if (!auth.currentWorkspaceId) {
    return NextResponse.json({ error: "No active workspace" }, { status: 400 });
  }
  if (!isWorkspaceAdminFor(auth, auth.currentWorkspaceId)) {
    return NextResponse.json({ error: "Workspace admin access required" }, { status: 403 });
  }

  const parsed = ApplyTemplateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid apply request", issues: parsed.error.flatten() }, { status: 400 });
  }

  const builtIn = builtInTemplates.find((template) => template.id === params.id);
  const saved = builtIn
    ? null
    : await prisma.template.findFirst({
        where: { id: params.id, workspace_id: auth.currentWorkspaceId, active: true },
      });
  const template = builtIn ?? (saved ? normalizeTemplate(saved) : null);
  if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });

  if (parsed.data.space_id) {
    const space = await prisma.space.findFirst({
      where: { id: parsed.data.space_id, workspace_id: auth.currentWorkspaceId },
    });
    if (!space) return NextResponse.json({ error: "Space not found" }, { status: 400 });
  }
  if (parsed.data.folder_id) {
    const folder = await prisma.folder.findFirst({
      where: { id: parsed.data.folder_id, workspace_id: auth.currentWorkspaceId },
    });
    if (!folder) return NextResponse.json({ error: "Folder not found" }, { status: 400 });
    if (parsed.data.space_id && folder.space_id !== parsed.data.space_id) {
      return NextResponse.json({ error: "Folder must belong to selected space" }, { status: 400 });
    }
  }
  if (parsed.data.company_id) {
    const company = await prisma.company.findFirst({
      where: { id: parsed.data.company_id, workspace_id: auth.currentWorkspaceId },
    });
    if (!company) return NextResponse.json({ error: "Company not found" }, { status: 400 });
  }

  const project = await prisma.project.create({
    data: {
      workspace_id: auth.currentWorkspaceId,
      owner_id: auth.prismaUser.id,
      name: parsed.data.name || template.config.projectName,
      description: template.description || null,
      space_id: parsed.data.space_id ?? null,
      folder_id: parsed.data.folder_id ?? null,
      company_id: parsed.data.company_id ?? null,
      tasks: {
        create: template.config.tasks.map((task, index) => ({
          title: task.title,
          priority: task.priority ?? "medium",
          position: index,
          company_id: parsed.data.company_id ?? null,
        })),
      },
    },
    include: { tasks: true },
  });

  await recordActivity({
    workspace_id: auth.currentWorkspaceId,
    actor_id: auth.prismaUser.id,
    type: "template_applied",
    entity_type: "template",
    entity_id: params.id,
    project_id: project.id,
    company_id: parsed.data.company_id ?? null,
    metadata: { template_name: template.name, project_name: project.name },
  });

  return NextResponse.json(project, { status: 201 });
}

export const POST = withErrorReporting("api:templates/id/apply:POST", POST_handler);
