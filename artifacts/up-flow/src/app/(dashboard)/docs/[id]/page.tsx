"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import Link from "next/link";
import TiptapEditor from "@/components/docs/tiptap-editor";

export default function DocPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [doc, setDoc] = useState<any>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    fetch(`/api/docs/${id}`)
      .then((r) => { if (!r.ok) { router.push("/docs"); return r; } return r.json(); })
      .then((data) => {
        if (data) {
          setDoc(data);
          setTitle(data.title);
          setContent(data.content);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/docs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      });
      if (!res.ok) throw new Error("Save failed");
      setDirty(false);
      toast.success("Saved");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }, [id, title, content]);

  // Auto-save on content change
  useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(save, 2000);
    return () => clearTimeout(timer);
  }, [dirty, content, save]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Topbar */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border sticky top-0 bg-background z-10">
        <Link href="/docs" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <input
          value={title}
          onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
          className="flex-1 text-lg font-semibold bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground"
          placeholder="Untitled"
        />
        <div className="flex items-center gap-2">
          {dirty && <span className="text-xs text-muted-foreground">Unsaved</span>}
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <TiptapEditor
            content={content}
            onChange={(c) => { setContent(c); setDirty(true); }}
          />
        </div>
      </div>
    </div>
  );
}
