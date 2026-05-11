import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function broadcastNotification(userId: string) {
  try {
    const admin = getAdminClient();
    await admin.channel(`notifications:${userId}`).send({
      type: "broadcast",
      event: "new_notification",
      payload: {},
    });
  } catch {
    // non-fatal
  }
}
