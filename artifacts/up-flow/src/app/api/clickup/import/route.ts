import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { runImport, type ImportProgress } from "@/lib/clickup-import";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  if (auth.prismaUser.role !== "admin") {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }
  if (!auth.currentWorkspaceId) {
    return new Response(JSON.stringify({ error: "No active workspace" }), { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    token?: string;
    team_id?: string;
  };
  const token = (body.token || process.env.CLICKUP_API_TOKEN || "").trim();
  const teamId = (body.team_id || "").trim();
  if (!token || !teamId) {
    return new Response(JSON.stringify({ error: "token and team_id required" }), { status: 400 });
  }

  const ownerUserId = auth.prismaUser.id;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (p: ImportProgress) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(p) + "\n"));
        } catch {}
      };
      try {
        await runImport({
          token,
          teamId,
          ownerUserId,
          workspaceId: auth.currentWorkspaceId,
          signal: req.signal,
          onProgress: send,
        });
      } catch (e) {
        console.error("[clickup-import] fatal:", e);
        try {
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                stage: "failed",
                spaces_done: 0,
                spaces_total: 0,
                folders_done: 0,
                folders_total: 0,
                lists_done: 0,
                lists_total: 0,
                tasks_done: 0,
                tasks_total: 0,
                created: { spaces: 0, folders: 0, lists: 0, tasks: 0, users: 0 },
                updated: { spaces: 0, folders: 0, lists: 0, tasks: 0 },
                errors: [(e as Error).message || String(e)],
                done: true,
              }) + "\n",
            ),
          );
        } catch {}
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
