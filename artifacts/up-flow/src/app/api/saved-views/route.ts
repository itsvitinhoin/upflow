import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-response";
import { buildPage, parsePagination } from "@/lib/pagination";
import { requireCurrentWorkspace } from "@/lib/api/scope";
import { withErrorReporting } from "@/lib/with-error-reporting";

const SavedViewSchema = z.object({
  name: z.string().trim().min(1).max(80),
  scope: z.enum(["workspace", "space", "folder", "project", "client"]),
  config: z.record(z.unknown()),
});

async function GET_handler(req: NextRequest) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  const scope = await requireCurrentWorkspace(auth);
  if (!scope.ok) return scope.response;

  const { searchParams } = new URL(req.url);
  const requestedScope = searchParams.get("scope");
  const { limit, cursor } = parsePagination(req, { defaultLimit: 50, maxLimit: 100 });

  const rows = await prisma.savedView.findMany({
    where: {
      workspace_id: scope.workspaceId,
      user_id: auth.prismaUser.id,
      ...(requestedScope ? { scope: requestedScope } : {}),
    },
    take: limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    orderBy: [{ updated_at: "desc" }, { id: "asc" }],
  });

  return NextResponse.json(buildPage(rows, limit));
}

async function POST_handler(req: NextRequest) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  const scope = await requireCurrentWorkspace(auth);
  if (!scope.ok) return scope.response;

  const parsed = SavedViewSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid saved view", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const savedView = await prisma.savedView.create({
    data: {
      workspace_id: scope.workspaceId,
      user_id: auth.prismaUser.id,
      name: parsed.data.name,
      scope: parsed.data.scope,
      config: parsed.data.config as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json(savedView, { status: 201 });
}

export const GET = withErrorReporting("api:saved-views:GET", GET_handler);
export const POST = withErrorReporting("api:saved-views:POST", POST_handler);
