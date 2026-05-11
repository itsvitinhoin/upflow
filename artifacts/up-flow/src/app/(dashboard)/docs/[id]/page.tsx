"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Check } from "lucide-react";
import Link from "next/link";
import TiptapEditor from "@/components/docs/tiptap-editor";
import { cn } from "@/lib/utils";

type SaveState = "idle" | "saving" | "saved" | "error";

export default function DocPage() {
  const params = useParams();
  const router = useRouter();
  const id = (params?.id ?? "") as string;

  const [doc, setDoc] = useState<Record<string, unknown> | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const titleRef = useRef(title);
  const contentRef = useRef(content);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorWrapperRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  useEffect(() => { titleRef.current = title; }, [title]);
  useEffect(() => { contentRef.current = content; }, [content]);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/docs/${id}`)
      .then((r) => {
        if (!r.ok) { router.push("/docs"); return null; }
        return r.json();
      })
      .then((data) => {
        if (data) {
          setDoc(data as Record<string, unknown>);
          setTitle((data as Record<string, unknown>).title as string);
          setContent((data as Record<string, unknown>).content);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id, router]);

  const saveNow = useCallback(async (titleVal: string, contentVal: unknown) => {
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    setSaveState("saving");
    try {
      const res = await fetch(`/api/docs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: titleVal, content: contentVal }),
      });
      if (!res.ok) throw new Error("Save failed");
      setSaveState("saved");
      savedTimerRef.current = setTimeout(() => setSaveState("idle"), 2000);
    } catch {
      setSaveState("error");
      toast.error("Failed to save");
    }
  }, [id]);

  const scheduleSave = useCallback((titleVal: string, contentVal: unknown) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveState("saving");
    saveTimerRef.current = setTimeout(() => {
      saveNow(titleVal, contentVal);
    }, 1000);
  }, [saveNow]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTitle(val);
    titleRef.current = val;
    initializedRef.current = true;
    scheduleSave(val, contentRef.current);
  };

  const handleContentChange = useCallback((c: unknown) => {
    setContent(c);
    contentRef.current = c;
    if (initializedRef.current) {
      scheduleSave(titleRef.current, c);
    }
  }, [scheduleSave]);

  useEffect(() => {
    if (!doc) return;
    const wrapper = editorWrapperRef.current;
    if (!wrapper) return;

    let observer: MutationObserver | null = null;

    const handleEditorChange = () => {
      if (!initializedRef.current) return;
      scheduleSave(titleRef.current, contentRef.current);
    };

    const handleKeyDown = () => {
      initializedRef.current = true;
      scheduleSave(titleRef.current, contentRef.current);
    };

    const setup = () => {
      const proseMirror = wrapper.querySelector('[contenteditable="true"]');
      if (proseMirror) {
        proseMirror.addEventListener("keydown", handleKeyDown);
        observer = new MutationObserver(handleEditorChange);
        observer.observe(proseMirror, {
          childList: true,
          subtree: true,
          characterData: true,
        });
      }
      wrapper.addEventListener("input", () => {
        initializedRef.current = true;
        handleEditorChange();
      });
    };

    const raf = requestAnimationFrame(setup);

    return () => {
      cancelAnimationFrame(raf);
      observer?.disconnect();
      const proseMirror = wrapper.querySelector('[contenteditable="true"]');
      if (proseMirror) {
        proseMirror.removeEventListener("keydown", handleKeyDown);
      }
    };
  }, [doc, scheduleSave]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!doc) return null;

  return (
    <div className="h-screen flex flex-col bg-background">
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border sticky top-0 bg-background z-10">
        <Link
          href="/docs"
          className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <input
          value={title}
          onChange={handleTitleChange}
          className="flex-1 text-lg font-semibold bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground"
          placeholder="Untitled"
        />
        <div className="flex items-center gap-3 flex-shrink-0">
          <span
            data-save-state={saveState}
            className={cn(
              "flex items-center gap-1.5 text-xs transition-opacity duration-200",
              saveState === "idle" ? "opacity-0 pointer-events-none" : "opacity-100"
            )}
            aria-label={
              saveState === "saving" ? "Autosave in progress" :
              saveState === "saved" ? "Document saved" :
              saveState === "error" ? "Save failed" : undefined
            }
          >
            {saveState === "saving" && (
              <>
                <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                <span className="text-muted-foreground">Saving…</span>
              </>
            )}
            {saveState === "saved" && (
              <>
                <Check className="w-3 h-3 text-green-600 dark:text-green-400" />
                <span className="text-green-600 dark:text-green-400">Saved</span>
              </>
            )}
            {saveState === "error" && (
              <span className="text-destructive">Save failed</span>
            )}
          </span>
          <button
            onClick={() => {
              initializedRef.current = true;
              saveNow(title, content);
            }}
            disabled={saveState === "saving"}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Save
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <div ref={editorWrapperRef}>
            <TiptapEditor
              content={content}
              onChange={handleContentChange}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
