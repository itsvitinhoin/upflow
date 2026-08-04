"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Check,
  FilePlus2,
  FileText,
  FolderKanban,
  Loader2,
  RefreshCcw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import TiptapEditor from "@/components/docs/tiptap-editor";
import { useLanguage } from "@/components/language-provider";
import type { Doc } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

type SaveState = "idle" | "saving" | "saved" | "error";

type PendingSave = {
  docId: string;
  title: string;
  content: unknown;
};

type SpaceProject = {
  id: string;
  name: string;
};

type SpaceDocsResponse = {
  items: Doc[];
  projects: SpaceProject[];
};

export function SpaceDocsTab({
  spaceId,
  canManage,
  refreshKey,
  onCreateProject,
}: {
  spaceId: string;
  canManage: boolean;
  refreshKey: number;
  onCreateProject: () => void;
}) {
  const { language, t } = useLanguage();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [projects, setProjects] = useState<SpaceProject[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<Doc | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const selectedDocRef = useRef<Doc | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef<PendingSave | null>(null);

  useEffect(() => {
    selectedDocRef.current = selectedDoc;
  }, [selectedDoc]);

  const applyResponse = useCallback((payload: SpaceDocsResponse) => {
    const items = sortDocs(payload.items);
    setDocs(items);
    setProjects(payload.projects);
    setSelectedProjectId((current) =>
      payload.projects.some((project) => project.id === current)
        ? current
        : (payload.projects[0]?.id ?? ""),
    );
    setSelectedDoc((current) => {
      if (current) {
        return items.find((doc) => doc.id === current.id) ?? items[0] ?? null;
      }
      return items[0] ?? null;
    });
  }, []);

  const loadDocs = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/spaces/" + spaceId + "/docs");
      if (!response.ok) {
        throw new Error(t("space.docsLoadErrorBody"));
      }
      applyResponse((await response.json()) as SpaceDocsResponse);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : t("space.docsLoadErrorBody"),
      );
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, [applyResponse, spaceId, t]);

  useEffect(() => {
    void loadDocs();
  }, [loadDocs, refreshKey]);

  const updateLocalDoc = useCallback((next: Doc) => {
    selectedDocRef.current = next;
    setSelectedDoc(next);
    setDocs((current) => current.map((doc) => (doc.id === next.id ? next : doc)));
  }, []);

  const saveDoc = useCallback(async (docId: string, title: string, content: unknown) => {
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    setSaveState("saving");
    try {
      const response = await fetch("/api/docs/" + docId, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      });
      if (!response.ok) throw new Error(t("docs.saveFailed"));
      const saved = (await response.json()) as Doc;
      setDocs((current) => sortDocs(current.map((doc) => (doc.id === saved.id ? saved : doc))));
      setSelectedDoc((current) => (current?.id === saved.id ? saved : current));
      selectedDocRef.current = saved;
      setSaveState("saved");
      savedTimerRef.current = setTimeout(() => setSaveState("idle"), 1800);
    } catch {
      setSaveState("error");
      toast.error(t("docs.saveFailed"));
    }
  }, [t]);

  const flushPendingSave = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const pending = pendingSaveRef.current;
    pendingSaveRef.current = null;
    if (!pending) return;
    await saveDoc(pending.docId, pending.title, pending.content);
  }, [saveDoc]);

  useEffect(() => () => {
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    void flushPendingSave();
  }, [flushPendingSave]);

  const scheduleSave = useCallback((docId: string, title: string, content: unknown) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    pendingSaveRef.current = { docId, title, content };
    setSaveState("saving");
    saveTimerRef.current = setTimeout(() => {
      const pending = pendingSaveRef.current;
      pendingSaveRef.current = null;
      saveTimerRef.current = null;
      if (pending) void saveDoc(pending.docId, pending.title, pending.content);
    }, 700);
  }, [saveDoc]);

  const selectDoc = (doc: Doc) => {
    void flushPendingSave();
    selectedDocRef.current = doc;
    setSelectedDoc(doc);
    setSaveState("idle");
  };

  const handleTitleChange = (title: string) => {
    const current = selectedDocRef.current;
    if (!current) return;
    const next = { ...current, title };
    updateLocalDoc(next);
    scheduleSave(next.id, title, next.content);
  };

  const handleContentChange = (content: unknown) => {
    const current = selectedDocRef.current;
    if (!current) return;
    const next = { ...current, content };
    updateLocalDoc(next);
    scheduleSave(next.id, next.title, content);
  };

  const handleCreate = async () => {
    if (!selectedProjectId) {
      onCreateProject();
      return;
    }

    setCreating(true);
    try {
      const response = await fetch("/api/spaces/" + spaceId + "/docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: t("docs.untitled"),
          project_id: selectedProjectId,
        }),
      });
      if (!response.ok) throw new Error(t("space.docsCreateFailed"));
      const created = (await response.json()) as Doc;
      setDocs((current) => sortDocs([created, ...current]));
      selectedDocRef.current = created;
      setSelectedDoc(created);
      setSaveState("idle");
      toast.success(t("space.docsCreated"));
    } catch (createError) {
      toast.error(
        createError instanceof Error ? createError.message : t("space.docsCreateFailed"),
      );
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    const current = selectedDocRef.current;
    if (!current) return;
    if (!confirm(t("docs.deleteConfirm", { title: current.title || t("docs.thisDoc") }))) {
      return;
    }

    setDeleting(true);
    try {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      pendingSaveRef.current = null;
      const response = await fetch("/api/docs/" + current.id, { method: "DELETE" });
      if (!response.ok) throw new Error(t("docs.deleteFailed"));
      const nextDocs = docs.filter((doc) => doc.id !== current.id);
      setDocs(nextDocs);
      const nextSelected = nextDocs[0] ?? null;
      selectedDocRef.current = nextSelected;
      setSelectedDoc(nextSelected);
      setSaveState("idle");
      toast.success(t("docs.deleted"));
    } catch {
      toast.error(t("docs.deleteFailed"));
    } finally {
      setDeleting(false);
    }
  };

  const handleManualSave = () => {
    const current = selectedDocRef.current;
    if (!current) return;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    pendingSaveRef.current = null;
    void saveDoc(current.id, current.title, current.content);
  };

  if (loading) {
    return <SpaceDocsSkeleton />;
  }

  if (error) {
    return (
      <section className="max-w-lg rounded-xl border border-white/10 bg-white/[0.03] p-5">
        <h3 className="text-base font-semibold text-foreground">{t("space.docsLoadErrorTitle")}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        <button
          type="button"
          onClick={() => void loadDocs()}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <RefreshCcw className="h-4 w-4" />
          {t("common.retry")}
        </button>
      </section>
    );
  }

  const projectName = selectedDoc?.project?.name ?? t("spaceDashboard.noProject");
  const dateLocale = language === "pt-BR" ? "pt-BR" : "en-US";

  return (
    <section
      className="overflow-hidden rounded-xl border border-white/10 bg-black/20"
      data-testid="space-docs-tab"
    >
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 px-4 py-4 sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <FileText className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-foreground">{t("space.docsTitle")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{t("space.docsDescription")}</p>
          </div>
        </div>
        {canManage && projects.length > 0 && (
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
            <label className="sr-only" htmlFor="space-doc-project">
              {t("space.docsProject")}
            </label>
            <select
              id="space-doc-project"
              value={selectedProjectId}
              onChange={(event) => setSelectedProjectId(event.target.value)}
              className="h-9 max-w-[13rem] rounded-lg border border-white/10 bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
              data-testid="space-doc-project-select"
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={creating}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              data-testid="space-docs-new"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FilePlus2 className="h-4 w-4" />}
              {t("space.newDoc")}
            </button>
          </div>
        )}
      </header>

      {projects.length === 0 ? (
        <SpaceDocsEmpty
          icon={<FolderKanban className="h-6 w-6" />}
          title={t("space.docsNoProjectsTitle")}
          body={t("space.docsNoProjectsBody")}
          actionLabel={canManage ? t("space.docsCreateProject") : undefined}
          onAction={canManage ? onCreateProject : undefined}
        />
      ) : docs.length === 0 ? (
        <SpaceDocsEmpty
          icon={<FileText className="h-6 w-6" />}
          title={t("space.docsEmptyTitle")}
          body={t("space.docsEmptyBody")}
          actionLabel={canManage ? t("space.newDoc") : undefined}
          onAction={canManage ? () => void handleCreate() : undefined}
        />
      ) : (
        <div className="grid min-h-[32rem] lg:grid-cols-[15rem_minmax(0,1fr)]">
          <aside className="border-b border-white/10 bg-white/[0.02] p-3 lg:border-b-0 lg:border-r">
            <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              {t(docs.length === 1 ? "docs.countOne" : "docs.countOther", { count: docs.length })}
            </p>
            <div className="space-y-1" aria-label={t("space.docsTitle")}>
              {docs.map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => selectDoc(doc)}
                  aria-current={selectedDoc?.id === doc.id ? "page" : undefined}
                  className={cn(
                    "w-full rounded-lg px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    selectedDoc?.id === doc.id
                      ? "bg-primary/15 text-foreground"
                      : "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground",
                  )}
                  data-testid={"space-doc-item-" + doc.id}
                >
                  <span className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 flex-shrink-0 text-primary" />
                    <span className="truncate text-sm font-medium">{doc.title || t("docs.untitled")}</span>
                  </span>
                  <span className="mt-1 block truncate pl-[1.375rem] text-xs opacity-75">
                    {doc.project?.name ?? t("spaceDashboard.noProject")}
                  </span>
                </button>
              ))}
            </div>
          </aside>

          {selectedDoc && (
            <article className="min-w-0 p-4 sm:p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-muted-foreground">
                    <FolderKanban className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="truncate">{projectName}</span>
                  </span>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t("docs.lastUpdated")}: {formatDate(selectedDoc.updated_at, dateLocale)}
                  </p>
                </div>
                {canManage && (
                  <div className="flex items-center gap-2">
                    <span
                      aria-live="polite"
                      className={cn(
                        "inline-flex items-center gap-1.5 text-xs transition-opacity",
                        saveState === "idle" ? "pointer-events-none opacity-0" : "opacity-100",
                        saveState === "error" ? "text-destructive" : "text-muted-foreground",
                      )}
                    >
                      {saveState === "saving" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      {saveState === "saved" && <Check className="h-3.5 w-3.5 text-upflow-success" />}
                      {saveState === "saving"
                        ? t("docs.saving")
                        : saveState === "saved"
                          ? t("docs.saved")
                          : saveState === "error"
                            ? t("docs.saveFailed")
                            : ""}
                    </span>
                    <button
                      type="button"
                      onClick={handleManualSave}
                      disabled={saveState === "saving"}
                      className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {t("common.save")}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete()}
                      disabled={deleting}
                      aria-label={t("docs.delete")}
                      title={t("docs.delete")}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </button>
                  </div>
                )}
              </div>

              <label className="sr-only" htmlFor="space-doc-title">
                {t("docs.documentTitle")}
              </label>
              <input
                id="space-doc-title"
                value={selectedDoc.title}
                onChange={(event) => handleTitleChange(event.target.value)}
                readOnly={!canManage}
                placeholder={t("docs.untitled")}
                className="mb-4 w-full border-0 bg-transparent px-0 text-2xl font-bold text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-0 sm:text-3xl"
              />
              <TiptapEditor
                key={selectedDoc.id}
                content={selectedDoc.content}
                onChange={handleContentChange}
                editable={canManage}
              />
            </article>
          )}
        </div>
      )}
    </section>
  );
}

function SpaceDocsEmpty({
  icon,
  title,
  body,
  actionLabel,
  onAction,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex min-h-[24rem] flex-col items-center justify-center px-5 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
        {icon}
      </span>
      <h4 className="mt-4 text-base font-semibold text-foreground">{title}</h4>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{body}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <FilePlus2 className="h-4 w-4" />
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function SpaceDocsSkeleton() {
  return (
    <section className="overflow-hidden rounded-xl border border-white/10 bg-black/20">
      <div className="flex items-center justify-between gap-4 border-b border-white/10 p-5">
        <div className="h-10 w-56 animate-pulse rounded-lg bg-white/[0.06]" />
        <div className="h-9 w-28 animate-pulse rounded-lg bg-white/[0.06]" />
      </div>
      <div className="grid min-h-[30rem] lg:grid-cols-[15rem_minmax(0,1fr)]">
        <div className="border-r border-white/10 p-3">
          <div className="space-y-2">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="h-14 animate-pulse rounded-lg bg-white/[0.05]" />
            ))}
          </div>
        </div>
        <div className="p-5">
          <div className="h-9 w-2/3 animate-pulse rounded bg-white/[0.06]" />
          <div className="mt-6 h-72 animate-pulse rounded-xl bg-white/[0.04]" />
        </div>
      </div>
    </section>
  );
}

function sortDocs(items: Doc[]) {
  return [...items].sort(
    (left, right) =>
      right.updated_at.localeCompare(left.updated_at) || left.id.localeCompare(right.id),
  );
}
