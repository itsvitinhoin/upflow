"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { X, Plus, Trash2, Settings2, Loader2, Pencil, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CustomFieldDefinition, CustomFieldType } from "@/lib/types";
import { useLanguage } from "@/components/language-provider";

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  fields: CustomFieldDefinition[];
  onChanged: () => void;
}

const TYPES: { value: CustomFieldType; labelKey: string }[] = [
  { value: "text", labelKey: "customFields.type.text" },
  { value: "number", labelKey: "customFields.type.number" },
  { value: "dropdown", labelKey: "customFields.type.dropdown" },
  { value: "date", labelKey: "customFields.type.date" },
  { value: "checkbox", labelKey: "customFields.type.checkbox" },
  { value: "people", labelKey: "customFields.type.people" },
];

export default function CustomFieldsManager({
  open,
  onClose,
  projectId,
  fields,
  onChanged,
}: Props) {
  const { t } = useLanguage();
  const [name, setName] = useState("");
  const [type, setType] = useState<CustomFieldType>("text");
  const [optionsText, setOptionsText] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editOptions, setEditOptions] = useState("");

  useEffect(() => {
    if (!open) {
      setName("");
      setType("text");
      setOptionsText("");
      setEditingId(null);
    }
  }, [open]);

  if (!open) return null;

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const options =
        type === "dropdown"
          ? optionsText
              .split(/[\n,]/)
              .map((o) => o.trim())
              .filter(Boolean)
          : null;
      const res = await fetch(`/api/projects/${projectId}/custom-fields`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), type, options }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || t("customFields.failed"));
      }
      setName("");
      setOptionsText("");
      onChanged();
      toast.success(t("customFields.added"));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (f: CustomFieldDefinition) => {
    setEditingId(f.id);
    setEditName(f.name);
    setEditOptions((f.options ?? []).join("\n"));
  };

  const saveEdit = async (f: CustomFieldDefinition) => {
    if (!editName.trim()) {
      toast.error(t("customFields.nameRequired"));
      return;
    }
    try {
      const body: Record<string, unknown> = { name: editName.trim() };
      if (f.type === "dropdown") {
        body.options = editOptions
          .split(/[\n,]/)
          .map((o) => o.trim())
          .filter(Boolean);
      }
      const res = await fetch(
        `/api/projects/${projectId}/custom-fields/${f.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) throw new Error();
      setEditingId(null);
      onChanged();
      toast.success(t("customFields.updated"));
    } catch {
      toast.error(t("customFields.failedUpdate"));
    }
  };

  const remove = async (fieldId: string) => {
    if (!confirm(t("customFields.deleteConfirm"))) return;
    try {
      const res = await fetch(
        `/api/projects/${projectId}/custom-fields/${fieldId}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error();
      onChanged();
      toast.success(t("customFields.deleted"));
    } catch {
      toast.error(t("customFields.failedDelete"));
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 z-50 flex h-dvh w-full flex-col border-l border-border bg-background shadow-2xl sm:max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-base font-semibold text-foreground">{t("toolbar.customFields")}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              {t("customFields.existingFields")}
            </h3>
            {fields.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("customFields.noneYet")}</p>
            ) : (
              <div className="border border-border rounded-lg divide-y divide-border bg-card">
                {fields.map((f) => {
                  const editing = editingId === f.id;
                  return (
                    <div key={f.id} className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        {editing ? (
                          <input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring dark:border-white/10 dark:bg-white/5"
                            autoFocus
                          />
                        ) : (
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-foreground truncate">{f.name}</div>
                            <div className="text-xs text-muted-foreground capitalize">
                              {t(`customFields.type.${f.type}`)}
                              {f.type === "dropdown" && f.options && f.options.length > 0 && (
                                <> · {t("customFields.optionsCount", { count: f.options.length })}</>
                              )}
                            </div>
                          </div>
                        )}
                        {editing ? (
                          <>
                            <button
                              onClick={() => saveEdit(f)}
                              className="text-upflow-success hover:bg-upflow-success/10 p-1.5 rounded"
                              title={t("common.save")}
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="text-muted-foreground hover:bg-muted p-1.5 rounded"
                              title={t("common.cancel")}
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEdit(f)}
                              className="text-muted-foreground hover:text-foreground p-1.5 rounded hover:bg-muted"
                              title={t("customFields.editField")}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => remove(f.id)}
                              className="text-muted-foreground hover:text-destructive p-1.5 rounded hover:bg-destructive/10"
                              title={t("customFields.deleteField")}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                      {editing && f.type === "dropdown" && (
                        <textarea
                          value={editOptions}
                          onChange={(e) => setEditOptions(e.target.value)}
                          rows={3}
                          placeholder={t("customFields.optionsPlaceholder")}
                          className="mt-2 w-full resize-none rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring dark:border-white/10 dark:bg-white/5"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <form onSubmit={create} className="space-y-3 border-t border-border pt-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("customFields.addNewField")}
            </h3>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">{t("companyDialog.name")}</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("customFields.namePlaceholder")}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring dark:border-white/10 dark:bg-white/5"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">{t("customFields.type")}</label>
              <div className="grid gap-1.5 sm:grid-cols-3">
                {TYPES.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setType(item.value)}
                    className={cn(
                      "text-xs px-2 py-1.5 rounded-md border transition-colors",
                      type === item.value
                        ? "bg-primary/[0.15] border-primary/40 text-primary"
                        : "border-border bg-background text-foreground hover:bg-accent dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10",
                    )}
                  >
                    {t(item.labelKey)}
                  </button>
                ))}
              </div>
            </div>
            {type === "dropdown" && (
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  {t("customFields.optionsHint")}
                </label>
                <textarea
                  value={optionsText}
                  onChange={(e) => setOptionsText(e.target.value)}
                  rows={3}
                  placeholder={t("customFields.optionsPlaceholder")}
                  className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring dark:border-white/10 dark:bg-white/5"
                />
              </div>
            )}
            <button
              type="submit"
              disabled={busy || !name.trim()}
              className="w-full flex items-center justify-center gap-1.5 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-sm font-medium py-2 rounded-md transition-colors"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {t("customFields.addField")}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
