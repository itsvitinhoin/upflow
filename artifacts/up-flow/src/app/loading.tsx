import { Loader2 } from "lucide-react";

/**
 * Top-level loading fallback shown during initial route resolution
 * before the dashboard chrome mounts. Per-segment loaders live next to
 * their layouts (see `app/(dashboard)/loading.tsx`).
 */
export default function RootLoading() {
  return (
    <div
      className="flex min-h-screen w-full items-center justify-center bg-background text-muted-foreground"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
