import { NextRequest, NextResponse } from "next/server";
import { Prisma, type CustomFieldType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth-helpers";

const VALID_TYPES: CustomFieldType[] = [
  "text",
  "number",
  "dropdown",
  "date",
  "checkbox",
  "people",
];

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { owner_id: true },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (
    auth.prismaUser.role !== "admin" &&
    project.owner_id !== auth.prismaUser.id
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const fields = await prisma.customFieldDefinition.findMany({
    where: { project_id: params.id },
    orderBy: [{ position: "asc" }, { created_at: "asc" }],
  });
  return NextResponse.json(fields);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { owner_id: true },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (project.owner_id !== auth.prismaUser.id && auth.prismaUser.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    type?: CustomFieldType;
    options?: unknown;
  };
  const name = (body.name || "").trim();
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!body.type || !VALID_TYPES.includes(body.type)) {
    return NextResponse.json({ error: "Invalid field type" }, { status: 400 });
  }

  const last = await prisma.customFieldDefinition.findFirst({
    where: { project_id: params.id },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  const created = await prisma.customFieldDefinition.create({
    data: {
      project_id: params.id,
      name,
      type: body.type,
      options:
        body.type === "dropdown" && Array.isArray(body.options)
          ? (body.options as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      position: (last?.position ?? -1) + 1,
    },
  });

  return NextResponse.json(created, { status: 201 });
}
