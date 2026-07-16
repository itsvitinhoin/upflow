import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-response";
import { withErrorReporting } from "@/lib/with-error-reporting";

const MAX_SIDEBAR_CLIENT_PINS = 5;
const PinSchema = z.object({ company_id: z.string().trim().uuid() });

const pinSelect = {
  id: true,
  company_id: true,
  position: true,
  company: {
    select: {
      id: true,
      name: true,
      status: true,
      commercial_status: true,
      plan_name: true,
    },
  },
} as const;

function isTransactionConflict(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2034"
  );
}

async function createSidebarPin(input: {
  workspaceId: string;
  userId: string;
  companyId: string;
}) {
  // Serializable retries keep the per-user cap correct when two pin requests race.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const existing = await tx.sidebarClientPin.findFirst({
            where: {
              workspace_id: input.workspaceId,
              user_id: input.userId,
              company_id: input.companyId,
            },
            select: pinSelect,
          });
          if (existing) return { item: existing, created: false, limitReached: false };

          const [count, last] = await Promise.all([
            tx.sidebarClientPin.count({
              where: { workspace_id: input.workspaceId, user_id: input.userId },
            }),
            tx.sidebarClientPin.findFirst({
              where: { workspace_id: input.workspaceId, user_id: input.userId },
              orderBy: [{ position: "desc" }, { created_at: "desc" }, { id: "desc" }],
              select: { position: true },
            }),
          ]);
          if (count >= MAX_SIDEBAR_CLIENT_PINS) {
            return { item: null, created: false, limitReached: true };
          }

          const item = await tx.sidebarClientPin.create({
            data: {
              workspace_id: input.workspaceId,
              user_id: input.userId,
              company_id: input.companyId,
              position: (last?.position ?? -1) + 1,
            },
            select: pinSelect,
          });
          return { item, created: true, limitReached: false };
        },
        { isolationLevel: "Serializable" },
      );
    } catch (error) {
      if (!isTransactionConflict(error) || attempt === 2) throw error;
    }
  }

  throw new Error("Unable to create client pin");
}

async function GET_handler() {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  if (!auth.currentWorkspaceId) return NextResponse.json({ items: [], limit: MAX_SIDEBAR_CLIENT_PINS });

  const items = await prisma.sidebarClientPin.findMany({
    where: {
      workspace_id: auth.currentWorkspaceId,
      user_id: auth.prismaUser.id,
    },
    orderBy: [{ position: "asc" }, { created_at: "asc" }, { id: "asc" }],
    select: pinSelect,
  });

  return NextResponse.json({ items, limit: MAX_SIDEBAR_CLIENT_PINS });
}

async function POST_handler(req: NextRequest) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  if (!auth.currentWorkspaceId) {
    return NextResponse.json({ error: "No active workspace" }, { status: 400 });
  }

  const parsed = PinSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid client pin" }, { status: 400 });
  }

  const company = await prisma.company.findFirst({
    where: { id: parsed.data.company_id, workspace_id: auth.currentWorkspaceId },
    select: { id: true },
  });
  if (!company) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const result = await createSidebarPin({
    workspaceId: auth.currentWorkspaceId,
    userId: auth.prismaUser.id,
    companyId: company.id,
  });

  if (result.limitReached) {
    return NextResponse.json(
      { error: "PIN_LIMIT", limit: MAX_SIDEBAR_CLIENT_PINS },
      { status: 409 },
    );
  }

  return NextResponse.json({ ...result, limit: MAX_SIDEBAR_CLIENT_PINS }, { status: result.created ? 201 : 200 });
}

export const GET = withErrorReporting("api:sidebar-pins:GET", GET_handler);
export const POST = withErrorReporting("api:sidebar-pins:POST", POST_handler);
