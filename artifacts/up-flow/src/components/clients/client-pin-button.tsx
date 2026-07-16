"use client";

import { useState } from "react";
import { Pin, PinOff } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/components/language-provider";
import { cn } from "@/lib/utils";

interface ClientPinButtonProps {
  companyId: string;
  companyName: string;
  pinned: boolean;
  onPinnedChange: (companyId: string, pinned: boolean) => void;
  className?: string;
}

export default function ClientPinButton({
  companyId,
  companyName,
  pinned,
  onPinnedChange,
  className,
}: ClientPinButtonProps) {
  const { t } = useLanguage();
  const [saving, setSaving] = useState(false);
  const label = pinned
    ? t("clientNavigation.unpinClient", { name: companyName })
    : t("clientNavigation.pinClient", { name: companyName });

  const togglePin = async () => {
    setSaving(true);
    try {
      const res = await fetch(
        pinned ? `/api/sidebar-pins/${companyId}` : "/api/sidebar-pins",
        pinned
          ? { method: "DELETE" }
          : {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ company_id: companyId }),
            },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(
          body?.error === "PIN_LIMIT"
            ? t("clientNavigation.pinLimit")
            : body?.error ?? t("clientNavigation.pinFailed"),
        );
      }

      onPinnedChange(companyId, !pinned);
      window.dispatchEvent(new CustomEvent("upflow:sidebar-refresh"));
      toast.success(t(pinned ? "clientNavigation.unpinned" : "clientNavigation.pinned"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("clientNavigation.pinFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <button
      type="button"
      onClick={togglePin}
      disabled={saving}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition hover:border-blue-300/40 hover:bg-blue-500/10 hover:text-blue-700 disabled:cursor-wait disabled:opacity-60 dark:border-blue-200/20 dark:bg-white/5 dark:text-blue-100/80 dark:hover:text-white",
        pinned && "border-blue-400/35 bg-blue-500/15 text-blue-700 dark:text-blue-100",
        className,
      )}
    >
      {pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
    </button>
  );
}
