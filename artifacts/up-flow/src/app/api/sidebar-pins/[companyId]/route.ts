import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-response";
import { withErrorReporting } from "@/lib/with-error-reporting";

async function DELETE_handler(
  req: NextRequest,
  { params }: { params: { companyId: string } },
) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  void req;

  if (!auth.currentWorkspaceId) {
    return NextResponse.json({ error: "No active workspace" }, { status: 400 });
  }

  await prisma.sidebarClientPin.deleteMany({
    where: {
      workspace_id: auth.currentWorkspaceId,
      user_id: auth.prismaUser.id,
      company_id: params.companyId,
    },
  });

  return NextResponse.json({ success: true });
}

export const DELETE = withErrorReporting("api:sidebar-pins:DELETE", DELETE_handler);
