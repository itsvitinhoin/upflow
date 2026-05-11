import { createClient } from "@supabase/supabase-js";

let serverClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (!serverClient) {
    serverClient = createClient(url, key, {
      auth: { persistSession: false },
    });
  }
  return serverClient;
}

export async function broadcastNotification(userId: string) {
  const client = getSupabaseServerClient();
  if (!client) return;
  try {
    await client.channel(`notifications:${userId}`).send({
      type: "broadcast",
      event: "new_notification",
      payload: { userId },
    });
  } catch {
  }
}
