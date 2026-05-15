"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { logError } from "@/lib/log-error";
import type { Project, Space, Folder as FolderT } from "@/lib/types";

const ICONS = ["📦", "🚀", "🎨", "💼", "🛠️", "🌱", "🔬", "📈", "💡", "🗂️"];

export function SpaceDialog({
  mode,
  space,
  onClose,
  onSaved,
}: {
  mode: "create" | "rename";
  space?: Space;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(space?.name ?? "");
  const [icon, setIcon] = useState(space?.icon ?? ICONS[0]);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const url = mode === "create" ? "/api/spaces" : `/api/spaces/${space!.id}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), icon }),
      });
      if (!res.ok) throw new Error(`Space ${mode} → ${res.status}`);
      toast.success(mode === "create" ? "Space created" : "Space renamed");
      onSaved();
    } catch (err) {
      logError("sidebar:space-dialog", err, { mode });
      toast.error("Could not save space");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        className="glass-strong rounded-2xl w-full max-w-sm p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-foreground">
            {mode === "create" ? "New space" : "Rename space"}
          </h3>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <label className="block text-xs font-medium text-foreground mb-1.5">Name</label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Marketing"
          className="w-full border border-white/10 bg-white/5 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <label className="block text-xs font-medium text-foreground mt-4 mb-1.5">Icon</label>
        <div className="flex flex-wrap gap-1.5">
          {ICONS.map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIcon(i)}
              className={cn(
                "w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-colors",
                icon === i ? "bg-primary/25 ring-2 ring-primary/60" : "bg-white/5 hover:bg-white/10"
              )}
            >
              {i}
            </button>
          ))}
        </div>
        <div className="flex gap-2 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 border border-white/10 text-foreground text-sm py-2 rounded-lg hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="flex-1 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-sm font-medium py-2 rounded-lg"
          >
            {mode === "create" ? "Create" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}

export function MoveProjectDialog({
  project,
  spaces,
  folders,
  onClose,
  onSaved,
}: {
  project: Project;
  spaces: Space[];
  folders: FolderT[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const initial =
    project.folder_id
      ? `folder:${project.folder_id}`
      : project.space_id
      ? `space:${project.space_id}`
      : "";
  const [target, setTarget] = useState<string>(initial);
  const [loading, setLoading] = useState(false);

  const save = async () => {
    setLoading(true);
    try {
      let space_id: string | null = null;
      let folder_id: string | null = null;
      if (target.startsWith("folder:")) {
        folder_id = target.slice("folder:".length);
        const f = folders.find((x) => x.id === folder_id);
        space_id = f?.space_id ?? null;
      } else if (target.startsWith("space:")) {
        space_id = target.slice("space:".length);
      }
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ space_id, folder_id }),
      });
      if (!res.ok) throw new Error(`Move project → ${res.status}`);
      toast.success("List moved");
      onSaved();
    } catch (err) {
      logError("sidebar:move-project-dialog", err, { id: project.id });
      toast.error("Could not move list");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="glass-strong rounded-2xl w-full max-w-sm p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-foreground">Move list</h3>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{project.name}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <label className="block text-xs font-medium text-foreground mb-1.5">Destination</label>
        <select
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="w-full border border-white/10 bg-white/5 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">— Unassigned —</option>
          {spaces.map((sp) => {
            const fs = folders.filter((f) => f.space_id === sp.id);
            return (
              <optgroup key={sp.id} label={`${sp.icon || "🗂️"} ${sp.name}`}>
                <option value={`space:${sp.id}`}>↳ (directly in space)</option>
                {fs.map((f) => (
                  <option key={f.id} value={`folder:${f.id}`}>
                    📁 {f.name}
                  </option>
                ))}
              </optgroup>
            );
          })}
        </select>
        <div className="flex gap-2 mt-6">
          <button
            onClick={onClose}
            className="flex-1 border border-white/10 text-foreground text-sm py-2 rounded-lg hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={loading}
            className="flex-1 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-sm font-medium py-2 rounded-lg"
          >
            Move
          </button>
        </div>
      </div>
    </div>
  );
}

export function FolderDialog({
  mode,
  space,
  folder,
  onClose,
  onSaved,
}: {
  mode: "create" | "rename";
  space?: Space;
  folder?: FolderT;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(folder?.name ?? "");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const url = mode === "create" ? "/api/folders" : `/api/folders/${folder!.id}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const body =
        mode === "create"
          ? { name: name.trim(), space_id: space!.id }
          : { name: name.trim() };
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Folder ${mode} → ${res.status}`);
      toast.success(mode === "create" ? "Folder created" : "Folder renamed");
      onSaved();
    } catch (err) {
      logError("sidebar:folder-dialog", err, { mode });
      toast.error("Could not save folder");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        className="glass-strong rounded-2xl w-full max-w-sm p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              {mode === "create" ? "New folder" : "Rename folder"}
            </h3>
            {mode === "create" && space && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                in {space.icon || "🗂️"} {space.name}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <label className="block text-xs font-medium text-foreground mb-1.5">Name</label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Q1 initiatives"
          className="w-full border border-white/10 bg-white/5 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="flex gap-2 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 border border-white/10 text-foreground text-sm py-2 rounded-lg hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="flex-1 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-sm font-medium py-2 rounded-lg"
          >
            {mode === "create" ? "Create" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}

export function NewListDialog({
  target,
  onClose,
  onSaved,
}: {
  target:
    | { kind: "space"; space: Space }
    | { kind: "folder"; folder: FolderT };
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const base = {
        name: name.trim(),
        description: description.trim() || null,
        due_date: dueDate || null,
      };
      const body =
        target.kind === "space"
          ? { ...base, space_id: target.space.id }
          : {
              ...base,
              space_id: target.folder.space_id,
              folder_id: target.folder.id,
            };
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Create list → ${res.status}`);
      toast.success("List created");
      onSaved();
    } catch (err) {
      logError("sidebar:new-list-dialog", err);
      toast.error("Could not create list");
    } finally {
      setLoading(false);
    }
  };

  const locationLabel =
    target.kind === "space"
      ? `${target.space.icon || "🗂️"} ${target.space.name}`
      : `📁 ${target.folder.name}`;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        className="glass-strong rounded-2xl w-full max-w-sm p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-foreground">New list</h3>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">in {locationLabel}</p>
          </div>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <label className="block text-xs font-medium text-foreground mb-1.5">Name</label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Sprint 12"
          className="w-full border border-white/10 bg-white/5 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <label className="block text-xs font-medium text-foreground mt-3 mb-1.5">
          Description <span className="text-muted-foreground font-normal">(optional)</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="What is this list about?"
          className="w-full border border-white/10 bg-white/5 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
        <label className="block text-xs font-medium text-foreground mt-3 mb-1.5">
          Due date <span className="text-muted-foreground font-normal">(optional)</span>
        </label>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="w-full border border-white/10 bg-white/5 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="flex gap-2 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 border border-white/10 text-foreground text-sm py-2 rounded-lg hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="flex-1 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-sm font-medium py-2 rounded-lg"
          >
            Create
          </button>
        </div>
      </form>
    </div>
  );
}
