import { createClient } from "@supabase/supabase-js";
import { logError } from "@/lib/log-error";

export function getSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function broadcastNotification(userId: string) {
  try {
    const admin = getSupabaseAdminClient();
    const result = await admin
      .channel(`notifications:${userId}`)
      .httpSend("new_notification", {});
    if (!result.success) {
      logError(
        "supabase:broadcast-notification",
        new Error(result.error),
        { user_id: userId, status: result.status },
      );
    }
  } catch (error) {
    // A persisted inbox notification remains available through polling even
    // if the immediate realtime signal cannot be delivered.
    logError("supabase:broadcast-notification", error, { user_id: userId });
  }
}
