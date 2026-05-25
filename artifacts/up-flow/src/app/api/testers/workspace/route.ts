import { NextResponse } from "next/server";
import { isWorkspaceAdmin } from "@/lib/auth-helpers";
import { requireAuth } from "@/lib/auth-response";
import { ensureTesterWorkspace } from "@/lib/tester-workspace";
import { withErrorReporting } from "@/lib/with-error-reporting";

async function POST_handler() {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;

  if (!isWorkspaceAdmin(auth)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const workspace = await ensureTesterWorkspace(auth.prismaUser.id);

  return NextResponse.json({ workspace }, { status: 200 });
}

export const POST = withErrorReporting("api:testers/workspace:POST", POST_handler);
