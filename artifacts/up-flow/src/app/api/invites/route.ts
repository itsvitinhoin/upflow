import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { getAuthUser, isWorkspaceAdmin } from "@/lib/auth-helpers";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

function generateToken(): string {
  return randomBytes(24).toString("base64url");
}

// GET: list pending invites for the active workspace (admin only)
export async function GET() {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isWorkspaceAdmin(auth) || !auth.currentWorkspaceId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const invites = await prisma.workspaceInvite.findMany({
    where: { workspace_id: auth.currentWorkspaceId, accepted_at: null },
    orderBy: { created_at: "desc" },
    select: {
      id: true,
      email: true,
      role: true,
      token: true,
      created_at: true,
      inviter: { select: { id: true, name: true, email: true } },
    },
  });
  return NextResponse.json(invites);
}

// POST: create one invite per email and return tokens / accept links.
export async function POST(req: NextRequest) {
  const rl = checkRateLimit(req, { windowMs: 60_000, max: 20, key: "invite" });
  if (!rl.ok) return rateLimitResponse(rl);

  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isWorkspaceAdmin(auth) || !auth.currentWorkspaceId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    emails?: string[];
    role?: "admin" | "member";
  };
  const emails = (body.emails || [])
    .map((e) => (typeof e === "string" ? e.trim().toLowerCase() : ""))
    .filter(Boolean);

  if (emails.length === 0) {
    return NextResponse.json(
      { error: "At least one email is required" },
      { status: 400 },
    );
  }
  if (emails.length > 50) {
    return NextResponse.json(
      { error: "Too many invites in one request" },
      { status: 400 },
    );
  }
  const re = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  const invalid = emails.find((e) => !re.test(e));
  if (invalid) {
    return NextResponse.json(
      { error: `Invalid email: ${invalid}` },
      { status: 400 },
    );
  }
  const role: "admin" | "member" = body.role === "admin" ? "admin" : "member";

  // De-duplicate.
  const unique = Array.from(new Set(emails));

  const origin =
    req.headers.get("origin") ||
    `https://${req.headers.get("host") ?? "localhost"}`;

  // Reuse an existing pending invite (workspace_id + email + role) so admins
  // calling this endpoint twice with the same address don't generate a pile
  // of dead tokens. If only the role differs we still create a fresh invite.
  const created = await Promise.all(
    unique.map(async (email) => {
      const existing = await prisma.workspaceInvite.findFirst({
        where: {
          workspace_id: auth.currentWorkspaceId!,
          email,
          role,
          accepted_at: null,
        },
        select: { id: true, email: true, role: true, token: true, created_at: true },
      });
      const invite =
        existing ??
        (await prisma.workspaceInvite.create({
          data: {
            workspace_id: auth.currentWorkspaceId!,
            email,
            role,
            token: generateToken(),
            invited_by: auth.prismaUser.id,
          },
          select: { id: true, email: true, role: true, token: true, created_at: true },
        }));
      return {
        ...invite,
        accept_url: `${origin}/invite/${invite.token}`,
        reused: existing !== null,
      };
    }),
  );

  // Email delivery is intentionally out-of-scope; this returns the accept
  // links so admins can share them manually.
  return NextResponse.json(
    { success: true, sent: created.length, invites: created },
    { status: 201 },
  );
}
