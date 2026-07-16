"use client";

import { Loader2 } from "lucide-react";
import { useLanguage } from "@/components/language-provider";

/**
 * Top-level loading fallback shown during initial route resolution
 * before the dashboard chrome mounts. Per-segment loaders live next to
 * their layouts (see `app/(dashboard)/loading.tsx`).
 */
export default function RootLoading() {
  const { t } = useLanguage();
  return (
    <div
      className="flex min-h-dvh w-full items-center justify-center bg-background text-muted-foreground"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
      <span className="sr-only">{t("common.loading")}</span>
    </div>
  );
}
