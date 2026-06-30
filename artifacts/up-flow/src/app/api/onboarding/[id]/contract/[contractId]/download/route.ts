import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-response";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { loadOnboardingAccess } from "@/lib/onboarding";
import { withErrorReporting } from "@/lib/with-error-reporting";

async function GET_handler(
  req: NextRequest,
  { params }: { params: { id: string; contractId: string } },
) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  void req;
  const access = await loadOnboardingAccess(auth, params.id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!access.canViewPrivateContract) {
    return NextResponse.json({ error: "Private contract access required" }, { status: 403 });
  }
  const contract = await prisma.clientContract.findFirst({
    where: { id: params.contractId, onboarding_id: params.id, workspace_id: access.onboarding.workspace_id },
  });
  if (!contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 });

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.storage
    .from(contract.storage_bucket)
    .createSignedUrl(contract.storage_path, 60);
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "Could not create a private contract download link." }, { status: 503 });
  }
  return NextResponse.json({ url: data.signedUrl, expires_in: 60 });
}

export const GET = withErrorReporting("api:onboarding/contract/download:GET", GET_handler);
