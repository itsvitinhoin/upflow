"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { X, Plus, Trash2, Settings2, Loader2, Pencil, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CustomFieldDefinition, CustomFieldType } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  fields: CustomFieldDefinition[];
  onChanged: () => void;
}

const TYPES: { value: CustomFieldType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "dropdown", label: "Dropdown" },
  { value: "date", label: "Date" },
  { value: "checkbox", label: "Checkbox" },
  { value: "people", label: "People" },
];

export default function CustomFieldsManager({
  open,
  onClose,
  projectId,
  fields,
  onChanged,
}: Props) {
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
        throw new Error(data.error || "Failed");
      }
      setName("");
      setOptionsText("");
      onChanged();
      toast.success("Field added");
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
      toast.error("Name is required");
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
      toast.success("Field updated");
    } catch {
      toast.error("Failed to update");
    }
  };

  const remove = async (fieldId: string) => {
    if (!confirm("Delete this field? Existing values will be removed.")) return;
    try {
      const res = await fetch(
        `/api/projects/${projectId}/custom-fields/${fieldId}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error();
      onChanged();
      toast.success("Field deleted");
    } catch {
      toast.error("Failed to delete");
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 z-50 flex h-dvh w-full flex-col border-l border-border bg-background shadow-2xl sm:max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-base font-semibold text-foreground">Custom fields</h2>
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
              Existing fields
            </h3>
            {fields.length === 0 ? (
              <p className="text-sm text-muted-foreground">No custom fields yet.</p>
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
                            className="flex-1 text-sm bg-white/5 border border-white/10 rounded-md px-2 py-1 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                            autoFocus
                          />
                        ) : (
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-foreground truncate">{f.name}</div>
                            <div className="text-xs text-muted-foreground capitalize">
                              {f.type}
                              {f.type === "dropdown" && f.options && f.options.length > 0 && (
                                <> · {f.options.length} options</>
                              )}
                            </div>
                          </div>
                        )}
                        {editing ? (
                          <>
                            <button
                              onClick={() => saveEdit(f)}
                              className="text-upflow-success hover:bg-upflow-success/10 p-1.5 rounded"
                              title="Save"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="text-muted-foreground hover:bg-muted p-1.5 rounded"
                              title="Cancel"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEdit(f)}
                              className="text-muted-foreground hover:text-foreground p-1.5 rounded hover:bg-muted"
                              title="Edit field"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => remove(f.id)}
                              className="text-muted-foreground hover:text-destructive p-1.5 rounded hover:bg-destructive/10"
                              title="Delete field"
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
                          placeholder="Options (one per line)"
                          className="w-full mt-2 text-xs bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
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
              Add a new field
            </h3>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Story points"
                className="w-full text-sm bg-white/5 border border-white/10 rounded-md px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Type</label>
              <div className="grid gap-1.5 sm:grid-cols-3">
                {TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setType(t.value)}
                    className={cn(
                      "text-xs px-2 py-1.5 rounded-md border transition-colors",
                      type === t.value
                        ? "bg-primary/15 border-primary/40 text-primary"
                        : "bg-white/5 border-white/10 text-foreground hover:bg-white/10",
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            {type === "dropdown" && (
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  Options (one per line or comma-separated)
                </label>
                <textarea
                  value={optionsText}
                  onChange={(e) => setOptionsText(e.target.value)}
                  rows={3}
                  placeholder="To do&#10;Doing&#10;Done"
                  className="w-full text-sm bg-white/5 border border-white/10 rounded-md px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>
            )}
            <button
              type="submit"
              disabled={busy || !name.trim()}
              className="w-full flex items-center justify-center gap-1.5 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-sm font-medium py-2 rounded-md transition-colors"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add field
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
