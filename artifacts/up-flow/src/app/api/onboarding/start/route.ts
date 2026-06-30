import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-response";
import { isWorkspaceAdminFor } from "@/lib/auth-helpers";
import { parseAppDate } from "@/lib/utils";
import { startClientOnboarding } from "@/lib/onboarding";
import { withErrorReporting } from "@/lib/with-error-reporting";

const StartSchema = z.object({
  project_id: z.string().trim().min(1),
  services: z.array(z.string().trim().min(1)).optional(),
  closing_date: z.string().nullable().optional(),
  expected_start_date: z.string().nullable().optional(),
  initial_notes: z.string().trim().nullable().optional(),
  responsible_salesperson_id: z.string().trim().nullable().optional(),
});

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = parseAppDate(value);
  return parsed === "invalid" ? "invalid" : parsed;
}

async function POST_handler(req: NextRequest) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  const parsed = StartSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid onboarding start", issues: parsed.error.flatten() }, { status: 400 });
  }

  const project = await prisma.project.findUnique({
    where: { id: parsed.data.project_id },
    select: { id: true, workspace_id: true, company_id: true },
  });
  if (!project?.company_id) {
    return NextResponse.json({ error: "Onboarding requires a client-linked project." }, { status: 400 });
  }
  if (!isWorkspaceAdminFor(auth, project.workspace_id)) {
    return NextResponse.json({ error: "Workspace admin access required" }, { status: 403 });
  }

  const closingDate = parseDate(parsed.data.closing_date);
  const expectedStartDate = parseDate(parsed.data.expected_start_date);
  if (closingDate === "invalid" || expectedStartDate === "invalid") {
    return NextResponse.json({ error: "Invalid onboarding date" }, { status: 400 });
  }

  const onboarding = await startClientOnboarding({
    projectId: project.id,
    actorId: auth.prismaUser.id,
    services: parsed.data.services,
    closingDate,
    expectedStartDate,
    initialNotes: parsed.data.initial_notes ?? null,
    responsibleSalespersonId: parsed.data.responsible_salesperson_id ?? null,
  });

  return NextResponse.json(onboarding, { status: 201 });
}

export const POST = withErrorReporting("api:onboarding/start:POST", POST_handler);
