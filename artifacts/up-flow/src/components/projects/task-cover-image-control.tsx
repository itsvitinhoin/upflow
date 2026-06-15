"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Link2, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface TaskCoverImageControlProps {
  value: string | null | undefined;
  onChange: (value: string | null) => void | Promise<void>;
  disabled?: boolean;
}

const MAX_IMAGE_BYTES = 2_000_000;

function isImageUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export default function TaskCoverImageControl({
  value,
  onChange,
  disabled = false,
}: TaskCoverImageControlProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [url, setUrl] = useState(value?.startsWith("data:") ? "" : value ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setUrl(value?.startsWith("data:") ? "" : value ?? "");
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
      toast.error("Use an image URL or upload an image file");
      return;
    }
    await save(trimmed);
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("Image is too large. Use an image under 2 MB.");
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
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Could not upload image");
      }
      setUrl("");
      await onChange(data.url);
      toast.success("Cover image uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not upload image");
    } finally {
      setSaving(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-3">
      {value ? (
        <div className="overflow-hidden rounded-lg border border-border bg-muted/30">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="Task cover"
            className="aspect-video w-full object-cover"
            loading="lazy"
          />
        </div>
      ) : (
        <div className="flex aspect-video items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 text-sm text-muted-foreground">
          No cover image
        </div>
      )}

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onBlur={() => {
              const currentUrlValue = value?.startsWith("data:") ? "" : value ?? "";
              if (currentUrlValue !== url.trim()) void applyUrl();
            }}
            placeholder="Paste image URL..."
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
          Upload
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
            aria-label="Remove cover image"
            title="Remove cover image"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Upload stores the image in Supabase Storage, or paste an existing image URL.
      </p>
    </div>
  );
}
