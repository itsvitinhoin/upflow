"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Link2, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/components/language-provider";
import { getTaskAssetPath, getTaskCoverDisplayUrl } from "@/lib/task-images";

interface TaskCoverImageControlProps {
  value: string | null | undefined;
  onChange: (value: string | null) => void | Promise<void>;
  disabled?: boolean;
  compact?: boolean;
}

const MAX_IMAGE_BYTES = 2_000_000;

function isImageUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

export default function TaskCoverImageControl({
  value,
  onChange,
  disabled = false,
  compact = false,
}: TaskCoverImageControlProps) {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [url, setUrl] = useState(
    value?.startsWith("data:") || getTaskAssetPath(value) ? "" : value ?? "",
  );
  const [saving, setSaving] = useState(false);
  const displayUrl = getTaskCoverDisplayUrl(value);

  useEffect(() => {
    setUrl(value?.startsWith("data:") || getTaskAssetPath(value) ? "" : value ?? "");
  }, [value]);

  const save = async (nextValue: string | null) => {
    setSaving(true);
    try {
      await onChange(nextValue);
    } finally {
      setSaving(false);
    }
  };

  const applyUrl = async () => {
    const trimmed = url.trim();
    if (!trimmed) {
      await save(null);
      return;
    }
    if (!isImageUrl(trimmed)) {
      toast.error(t("taskCover.invalidImage"));
      return;
    }
    await save(trimmed);
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(t("taskCover.chooseImage"));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error(t("taskCover.imageTooLarge"));
      return;
    }
    setSaving(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/uploads/task-cover", {
        method: "POST",
        body: form,
      });
      const data = (await res.json().catch(() => ({}))) as { reference?: string; error?: string };
      if (!res.ok || !data.reference) {
        throw new Error(data.error || t("taskCover.couldNotUpload"));
      }
      setUrl("");
      await onChange(data.reference);
      toast.success(t("taskCover.uploaded"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("taskCover.couldNotUpload"));
    } finally {
      setSaving(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-3">
      {displayUrl ? (
        <div
          className={
            compact
              ? "flex items-center gap-3 rounded-lg border border-border bg-muted/20 p-2"
              : "overflow-hidden rounded-lg border border-border bg-muted/30"
          }
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={displayUrl}
            alt={t("taskCover.alt")}
            className={compact ? "h-14 w-20 rounded-md object-cover" : "aspect-video w-full object-cover"}
            loading="lazy"
          />
          {compact && <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{t("taskCover.alt")}</span>}
        </div>
      ) : compact ? null : (
        <div className="flex aspect-video items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 text-sm text-muted-foreground">
          {t("taskCover.none")}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onBlur={() => {
              const currentUrlValue =
                value?.startsWith("data:") || getTaskAssetPath(value) ? "" : value ?? "";
              if (currentUrlValue !== url.trim()) void applyUrl();
            }}
            placeholder={t("taskCover.pasteUrl")}
            disabled={disabled || saving}
            className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
          />
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || saving}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          {t("taskCover.upload")}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => {
              setUrl("");
              void save(null);
            }}
            disabled={disabled || saving}
            className="inline-flex items-center rounded-lg border border-border px-3 py-2 text-destructive hover:bg-destructive/10 disabled:opacity-60"
            aria-label={t("taskCover.remove")}
            title={t("taskCover.remove")}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {t("taskCover.help")}
      </p>
    </div>
  );
}
