"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, ChevronUp, Loader2, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/components/language-provider";
import type { WorkflowStatus } from "@/lib/types";
import { DEFAULT_SPACE_TASK_STATUSES } from "@/lib/space-task-status";

type DraftStatus = {
  clientId: string;
  id?: string;
  name: string;
  color: string;
  terminal: boolean;
};

const COLORS = ["#64748b", "#3b82f6", "#14b8a6", "#a855f7", "#eab308", "#22c55e", "#ef4444"];

function clientId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function defaultDrafts(): DraftStatus[] {
  return DEFAULT_SPACE_TASK_STATUSES.map((status) => ({ ...status, clientId: clientId() }));
}

function draftsFromApi(items: WorkflowStatus[], persisted: boolean): DraftStatus[] {
  return items.length
    ? items.map((status) => ({
        clientId: clientId(),
        ...(persisted ? { id: status.id } : {}),
        name: status.name,
        color: status.color ?? "#64748b",
        terminal: status.terminal,
      }))
    : defaultDrafts();
}

export function SpaceWorkflowStatusManager({
  open,
  spaceId,
  onClose,
  onSaved,
}: {
  open: boolean;
  spaceId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useLanguage();
  const [statuses, setStatuses] = useState<DraftStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    fetch(`/api/spaces/${spaceId}/workflow-statuses`)
      .then(async (res) => {
        if (!res.ok) throw new Error(await readError(res, t("space.statusesLoadError")));
        return (await res.json()) as { items?: WorkflowStatus[]; suggested?: WorkflowStatus[] };
      })
      .then((data) => {
        if (!active) return;
        const persisted = data.items ?? [];
        setStatuses(draftsFromApi(persisted.length ? persisted : data.suggested ?? [], persisted.length > 0));
      })
      .catch((error) => {
        if (active) toast.error(error instanceof Error ? error.message : t("space.statusesLoadError"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, spaceId, t]);

  const invalid = useMemo(
    () =>
      statuses.length === 0 ||
      statuses.some((status) => !status.name.trim()) ||
      !statuses.some((status) => status.terminal),
    [statuses],
  );

  if (!open) return null;

  const update = (id: string, patch: Partial<DraftStatus>) => {
    setStatuses((current) =>
      current.map((status) => (status.clientId === id ? { ...status, ...patch } : status)),
    );
  };

  const move = (from: number, direction: -1 | 1) => {
    const to = from + direction;
    if (to < 0 || to >= statuses.length) return;
    setStatuses((current) => {
      const next = [...current];
      [next[from], next[to]] = [next[to], next[from]];
      return next;
    });
  };

  const add = () => {
    setStatuses((current) => [
      ...current,
      {
        clientId: clientId(),
        name: "",
        color: COLORS[current.length % COLORS.length],
        terminal: false,
      },
    ]);
  };

  const remove = (id: string) => {
    if (statuses.length === 1) {
      toast.error(t("space.statusesOneRequired"));
      return;
    }
    setStatuses((current) => current.filter((status) => status.clientId !== id));
  };

  const save = async () => {
    if (invalid) {
      toast.error(
        statuses.some((status) => !status.name.trim())
          ? t("space.statusesNameRequired")
          : t("space.statusesCompleteRequired"),
      );
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/spaces/${spaceId}/workflow-statuses`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          statuses: statuses.map(({ id, name, color, terminal }) => ({
            ...(id ? { id } : {}),
            name: name.trim(),
            color,
            terminal,
          })),
        }),
      });
      if (!res.ok) throw new Error(await readError(res, t("space.statusesSaveError")));
      toast.success(t("space.statusesSaved"));
      onSaved();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("space.statusesSaveError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        aria-label={t("common.close")}
        className="fixed inset-0 z-40 cursor-default bg-black/55"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={t("space.taskStatuses")}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-border bg-background shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-foreground">{t("space.taskStatuses")}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            title={t("common.close")}
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex min-h-40 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-2">
              {statuses.map((status, index) => (
                <div key={status.clientId} className="grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-lg border border-border bg-card p-2.5">
                  <div className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                      className="rounded p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                      title={t("space.statusesMoveUp")}
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(index, 1)}
                      disabled={index === statuses.length - 1}
                      className="rounded p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                      title={t("space.statusesMoveDown")}
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="min-w-0 space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={status.color}
                        aria-label={t("space.statusesColor")}
                        onChange={(event) => update(status.clientId, { color: event.target.value })}
                        className="h-8 w-8 shrink-0 cursor-pointer rounded border border-border bg-transparent p-0.5"
                      />
                      <input
                        value={status.name}
                        maxLength={120}
                        onChange={(event) => update(status.clientId, { name: event.target.value })}
                        placeholder={t("space.statusesName")}
                        className="min-w-0 flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                    <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={status.terminal}
                        onChange={(event) => update(status.clientId, { terminal: event.target.checked })}
                        className="h-3.5 w-3.5 rounded border-border accent-primary"
                      />
                      <Check className="h-3.5 w-3.5 text-upflow-success" />
                      {t("space.statusesComplete")}
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(status.clientId)}
                    className="rounded-md p-2 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                    title={t("space.statusesRemove")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={add}
                className="inline-flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-sm font-semibold text-muted-foreground transition hover:border-primary/50 hover:bg-primary/5 hover:text-primary"
              >
                <Plus className="h-4 w-4" />
                {t("space.statusesAdd")}
              </button>
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-3 py-2 text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={loading || saving || invalid}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("space.statusesSave")}
          </button>
        </footer>
      </section>
    </>
  );
}

async function readError(res: Response, fallback: string) {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error || fallback;
  } catch {
    return fallback;
  }
}
