import { createBrowserClient } from "@supabase/ssr";

export type SupabaseBrowserClientOptions = {
  detectSessionInUrl?: boolean;
};

export function createSupabaseBrowserClient(options: SupabaseBrowserClientOptions = {}) {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        flowType: "pkce",
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: options.detectSessionInUrl ?? true,
      },
    }
  );
}
