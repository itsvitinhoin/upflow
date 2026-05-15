"use client";

import { useState } from "react";
import Header from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Download, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { useAppUser } from "@/components/user-provider";

interface Team {
  id: string;
  name: string;
}

interface Preview {
  spaces: number;
  folders: number;
  lists: number;
  tasks: number;
}

interface Progress {
  stage: string;
  spaces_done: number;
  spaces_total: number;
  folders_done: number;
  folders_total: number;
  lists_done: number;
  lists_total: number;
  tasks_done: number;
  tasks_total: number;
  created: { spaces: number; folders: number; lists: number; tasks: number; users: number };
  updated: { spaces: number; folders: number; lists: number; tasks: number };
  errors: string[];
  done: boolean;
}

export default function ClickUpImportPage() {
  const user = useAppUser();
  const [token, setToken] = useState("");
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamId, setTeamId] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [busy, setBusy] = useState<"idle" | "connecting" | "previewing" | "importing">("idle");

  const isAdmin = !!user;

  const handleConnect = async () => {
    setBusy("connecting");
    setTeams([]);
    setTeamId("");
    setPreview(null);
    setProgress(null);
    try {
      const res = await fetch("/api/clickup/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      });
      const data = await res.json();
      if (res.status === 403) throw new Error("Only admins can run the ClickUp import.");
      if (!res.ok) throw new Error(data.error || "Could not connect");
      setTeams(data.teams);
      if (data.teams.length === 1) setTeamId(data.teams[0].id);
      toast.success(`Found ${data.teams.length} workspace${data.teams.length === 1 ? "" : "s"}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy("idle");
    }
  };

  const handlePreview = async () => {
    if (!teamId) return;
    setBusy("previewing");
    setPreview(null);
    try {
      const res = await fetch("/api/clickup/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim(), team_id: teamId }),
      });
      const data = await res.json();
      if (res.status === 403) throw new Error("Only admins can run the ClickUp import.");
      if (!res.ok) throw new Error(data.error || "Preview failed");
      setPreview(data);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy("idle");
    }
  };

  const handleImport = async () => {
    if (!teamId) return;
    if (
      !confirm(
        "Start the import? Existing items linked to ClickUp will be updated; new ones will be created.",
      )
    )
      return;
    setBusy("importing");
    setProgress(null);
    try {
      const res = await fetch("/api/clickup/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim(), team_id: teamId }),
      });
      if (res.status === 403) {
        throw new Error("Only admins can run the ClickUp import.");
      }
      if (!res.ok || !res.body) {
        const t = await res.text().catch(() => "");
        throw new Error(t || "Import failed");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let last: Progress | null = null;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const p = JSON.parse(trimmed) as Progress;
            setProgress(p);
            last = p;
          } catch {
            // Stream chunk wasn't a complete JSON object — most likely a
            // mid-line buffer split. Safe to skip; the next chunk will
            // contain the full line.
          }
        }
      }
      window.dispatchEvent(new Event("upflow:sidebar-refresh"));
      if (last && last.done && last.stage !== "failed" && last.errors.length === 0) {
        toast.success("Import complete");
      } else if (last && last.stage === "failed") {
        toast.error(last.errors[0] || "Import failed");
      } else if (last && last.errors.length > 0) {
        toast.warning(
          `Import finished with ${last.errors.length} error${last.errors.length === 1 ? "" : "s"}: ${last.errors[0]}`,
        );
      } else {
        toast.error("Import did not complete");
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy("idle");
    }
  };

  if (!isAdmin) {
    return (
      <>
        <Header title="Import from ClickUp" />
        <div className="p-6 max-w-2xl mx-auto">
          <div className="bg-card border border-border rounded-xl p-6 text-center text-muted-foreground">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-60" />
            <p className="font-medium">Admins only</p>
            <p className="text-sm mt-1">
              Ask a workspace admin to run the ClickUp import.
            </p>
          </div>
        </div>
      </>
    );
  }

  const pct = (done: number, total: number) =>
    total === 0 ? 0 : Math.min(100, Math.round((done / total) * 100));

  return (
    <>
      <Header title="Import from ClickUp" />
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">ClickUp import</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                One-time bulk import of Spaces, Folders, Lists and Tasks. Re-running
                updates existing items in place — nothing is duplicated.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="cu-token">Personal API token</Label>
              <p className="text-xs text-muted-foreground mt-1 mb-2">
                In ClickUp: avatar → Settings → Apps → Generate. Token starts with{" "}
                <code className="text-foreground/80">pk_</code>.
              </p>
              <div className="flex gap-2">
                <Input
                  id="cu-token"
                  type="password"
                  placeholder="pk_…"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  autoComplete="off"
                />
                <Button
                  onClick={handleConnect}
                  disabled={busy !== "idle" || !token.trim()}
                >
                  {busy === "connecting" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Connect"
                  )}
                </Button>
              </div>
            </div>

            {teams.length > 0 && (
              <div>
                <Label htmlFor="cu-team">ClickUp workspace</Label>
                <select
                  id="cu-team"
                  value={teamId}
                  onChange={(e) => {
                    setTeamId(e.target.value);
                    setPreview(null);
                  }}
                  className="mt-2 w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Select a workspace…</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {teamId && (
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  variant="outline"
                  onClick={handlePreview}
                  disabled={busy !== "idle"}
                >
                  {busy === "previewing" ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  Preview counts
                </Button>
                <Button onClick={handleImport} disabled={busy !== "idle"}>
                  {busy === "importing" ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  Start import
                </Button>
              </div>
            )}
          </div>
        </div>

        {preview && (
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold mb-3">Will import</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                ["Spaces", preview.spaces],
                ["Folders", preview.folders],
                ["Lists", preview.lists],
                ["Tasks", preview.tasks],
              ].map(([label, n]) => (
                <div
                  key={label as string}
                  className="rounded-lg border border-border bg-background/40 p-3"
                >
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {label as string}
                  </p>
                  <p className="text-2xl font-bold tabular-nums mt-0.5">{n as number}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {progress && (
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Progress</h3>
              <span className="text-xs text-muted-foreground capitalize">
                {progress.stage}
              </span>
            </div>
            <div className="space-y-3">
              {(
                [
                  ["Spaces", progress.spaces_done, progress.spaces_total],
                  ["Folders", progress.folders_done, progress.folders_total],
                  ["Lists", progress.lists_done, progress.lists_total],
                  ["Tasks", progress.tasks_done, progress.tasks_total],
                ] as const
              ).map(([label, done, total]) => (
                <div key={label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="tabular-nums">
                      {done} / {total}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${pct(done, total)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {progress.done && (
              <div className="mt-4 pt-4 border-t border-border">
                <div className="flex items-center gap-2 text-sm font-medium mb-2">
                  {progress.errors.length === 0 ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-upflow-success" />
                      Import complete
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-4 h-4 text-upflow-warning" />
                      Finished with {progress.errors.length} error
                      {progress.errors.length === 1 ? "" : "s"}
                    </>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                  {[
                    ["Spaces", progress.created.spaces, progress.updated.spaces],
                    ["Folders", progress.created.folders, progress.updated.folders],
                    ["Lists", progress.created.lists, progress.updated.lists],
                    ["Tasks", progress.created.tasks, progress.updated.tasks],
                    ["Users", progress.created.users, 0],
                  ].map(([label, c, u]) => (
                    <div
                      key={label as string}
                      className="rounded-md border border-border p-2"
                    >
                      <p className="text-muted-foreground">{label as string}</p>
                      <p className="tabular-nums">
                        +{c as number} new · {u as number} updated
                      </p>
                    </div>
                  ))}
                </div>
                {progress.errors.length > 0 && (
                  <details className="mt-3 text-xs">
                    <summary className="cursor-pointer text-muted-foreground">
                      View errors
                    </summary>
                    <ul className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                      {progress.errors.slice(0, 50).map((er, i) => (
                        <li key={i} className="text-upflow-danger/80 font-mono">
                          {er}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
