import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-response";
import { recordActivity } from "@/lib/activity";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { loadOnboardingAccess, recomputeOnboardingProgress } from "@/lib/onboarding";
import { withErrorReporting } from "@/lib/with-error-reporting";

const BUCKET = process.env.CLIENT_CONTRACTS_BUCKET || "client-contracts";
const MAX_CONTRACT_BYTES = 20_000_000;
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

function cleanFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "contract";
}

function isContractItemText(value: string) {
  const text = value.toLowerCase();
  return text.includes("contract") || text.includes("contrato");
}

async function POST_handler(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  const access = await loadOnboardingAccess(auth, params.id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!access.canUploadContract) {
    return NextResponse.json({ error: "Only admins and Finance can upload private contracts." }, { status: 403 });
  }
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  ) {
    return NextResponse.json(
      { error: "Private contract storage is not configured.", code: "CONTRACT_STORAGE_NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Contract file is required" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Upload a PDF, Word document, PNG, JPG, or WebP file." }, { status: 400 });
  }
  if (file.size > MAX_CONTRACT_BYTES) {
    return NextResponse.json({ error: "Contract file is too large. Use a file under 20 MB." }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const path = [
    access.onboarding.workspace_id,
    access.onboarding.company_id,
    access.onboarding.id,
    `${Date.now()}-${randomUUID()}-${cleanFileName(file.name)}`,
  ].join("/");

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: file.type,
    cacheControl: "3600",
    upsert: false,
  });
  if (error) {
    return NextResponse.json(
      { error: "Could not upload private contract. Confirm the private Supabase bucket exists.", code: "CONTRACT_UPLOAD_FAILED" },
      { status: 503 },
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const contract = await tx.clientContract.create({
      data: {
        onboarding_id: access.onboarding.id,
        workspace_id: access.onboarding.workspace_id,
        company_id: access.onboarding.company_id,
        project_id: access.onboarding.project_id,
        file_name: file.name,
        storage_bucket: BUCKET,
        storage_path: path,
        mime_type: file.type,
        size_bytes: file.size,
        status: "uploaded",
        visibility: "private",
        uploaded_by: auth.prismaUser.id,
      },
    });
    await tx.onboardingChecklistItem.updateMany({
      where: { onboarding_id: access.onboarding.id, department: "Contract" },
      data: { status: "complete", completed_at: new Date(), completed_by: auth.prismaUser.id },
    });
    const contractItems = await tx.onboardingChecklistItem.findMany({
      where: { onboarding_id: access.onboarding.id },
      select: { id: true, task_id: true, title: true, department: true },
    });
    const routedContractItems = contractItems.filter((item) =>
      isContractItemText(`${item.department} ${item.title}`),
    );
    if (routedContractItems.length > 0) {
      await tx.onboardingChecklistItem.updateMany({
        where: { id: { in: routedContractItems.map((item) => item.id) } },
        data: { status: "complete", completed_at: new Date(), completed_by: auth.prismaUser.id },
      });
      const taskIds = routedContractItems
        .map((item) => item.task_id)
        .filter((taskId): taskId is string => Boolean(taskId));
      if (taskIds.length > 0) {
        await tx.task.updateMany({
          where: { id: { in: taskIds } },
          data: { status: "done" },
        });
      }
    }
    const onboarding = await recomputeOnboardingProgress(tx, access.onboarding.id);
    return { onboarding, contract };
  });

  await recordActivity({
    workspace_id: access.onboarding.workspace_id,
    actor_id: auth.prismaUser.id,
    type: "client_contract_uploaded",
    entity_type: "client_contract",
    entity_id: updated.contract.id,
    project_id: access.onboarding.project_id,
    company_id: access.onboarding.company_id,
    metadata: { file_name: file.name, visibility: "private" },
  });

  return NextResponse.json(updated.onboarding, { status: 201 });
}

export const POST = withErrorReporting("api:onboarding/contract:POST", POST_handler);
