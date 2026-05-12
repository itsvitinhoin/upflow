import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { runImport, type ImportProgress } from "@/lib/clickup-import";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

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
          signal: req.signal,
          onProgress: send,
        });
      } catch (e) {
        try {
          controller.enqueue(
            encoder.encode(
              JSON.stringify({ stage: "failed", error: (e as Error).message, done: true }) + "\n",
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
