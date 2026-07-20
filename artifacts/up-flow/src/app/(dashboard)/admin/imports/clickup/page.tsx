"use client";

import { useCallback, useEffect, useState } from "react";

type Source = { id: string; name: string };
type Folder = Source & { lists: Source[] };
type Item = { space: Source; folders: Folder[]; lists: Source[] };
type Selection = {
  space_id: string;
  space_name: string;
  folder_id?: string;
  folder_name?: string;
  list_id: string;
  list_name: string;
};
type Preview = {
  lists: number;
  tasks: number;
  assignee_emails: string[];
};
type Job = {
  id: string;
  status: string;
  cursor: number;
  total: number;
  imported: number;
  failed: number;
  selected_source_ids?: unknown[];
  report?: {
    failures?: Array<{ list_id: string; list_name?: string; error: string }>;
  };
};
type ApiError = { error?: string };
type WorkspacesResponse = { teams?: Source[] };
type HierarchyResponse = { items?: Item[] };
type JobsResponse = { items?: Job[] };
type LoadingAction =
  | "workspaces"
  | "hierarchy"
  | "preview"
  | "start"
  | "resume"
  | "cancel"
  | null;

async function requestJson<T>(
  input: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(input, init);
  const payload = (await response.json().catch(() => ({}))) as T & ApiError;
  if (!response.ok) {
    throw new Error(payload.error || `Request failed (${response.status}).`);
  }
  return payload;
}

function errorMessage(prefix: string, error: unknown): string {
  const detail = error instanceof Error ? error.message : "";
  return detail ? `${prefix} ${detail}` : prefix;
}

export default function ClickUpImportPage() {
  const [workspaces, setWorkspaces] = useState<Source[]>([]);
  const [source, setSource] = useState("");
  const [hierarchy, setHierarchy] = useState<Item[]>([]);
  const [selected, setSelected] = useState<Record<string, Selection>>({});
  const [preview, setPreview] = useState<Preview | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState<LoadingAction>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const restoreExistingJob = useCallback(
    async (signal?: AbortSignal, showError = false): Promise<boolean> => {
      try {
        const payload = await requestJson<JobsResponse>(
          "/api/admin/imports/clickup/jobs",
          { cache: "no-store", signal },
        );
        if (signal?.aborted) return false;
        const jobs = Array.isArray(payload.items) ? payload.items : [];
        const existing = jobs.find((item) =>
          ["queued", "running", "paused", "failed"].includes(item.status),
        );
        if (!existing) return false;
        setJob(existing);
        return true;
      } catch (cause) {
        if (!signal?.aborted && showError) {
          setError(errorMessage("Could not restore the migration job.", cause));
        }
        return false;
      }
    },
    [],
  );

  useEffect(() => {
    const controller = new AbortController();

    void (async () => {
      setLoading("workspaces");
      setError("");
      try {
        const payload = await requestJson<WorkspacesResponse>(
          "/api/admin/imports/clickup/workspaces",
          { cache: "no-store", signal: controller.signal },
        );
        if (controller.signal.aborted) return;
        const teams = Array.isArray(payload.teams) ? payload.teams : [];
        setWorkspaces(teams);
        if (!teams.length) {
          setMessage("No ClickUp workspaces are available for this connection.");
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(errorMessage("Could not load ClickUp workspaces.", cause));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(null);
      }
    })();

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void restoreExistingJob(controller.signal);
    return () => controller.abort();
  }, [restoreExistingJob]);

  function selectWorkspace(value: string) {
    setSource(value);
    setHierarchy([]);
    setSelected({});
    setPreview(null);
    setMessage("");
    setError("");
  }

  async function loadHierarchy() {
    if (!source || loading) return;

    setLoading("hierarchy");
    setError("");
    setMessage("");
    setHierarchy([]);
    setSelected({});
    setPreview(null);
    try {
      const payload = await requestJson<HierarchyResponse>(
        "/api/admin/imports/clickup/hierarchy",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source_workspace_id: source }),
        },
      );
      const items = Array.isArray(payload.items) ? payload.items : [];
      setHierarchy(items);
      setMessage(
        items.length
          ? "Select the lists to include in the migration preview."
          : "No eligible ClickUp spaces were found for this workspace.",
      );
    } catch (cause) {
      setError(errorMessage("Could not load spaces and lists.", cause));
    } finally {
      setLoading(null);
    }
  }

  function toggle(value: Selection) {
    setSelected((current) => {
      const next = { ...current };
      if (next[value.list_id]) delete next[value.list_id];
      else next[value.list_id] = value;
      return next;
    });
    setPreview(null);
  }

  async function runPreview() {
    if (!source || !Object.keys(selected).length || loading) return;

    setLoading("preview");
    setError("");
    setMessage("");
    try {
      const payload = await requestJson<Preview>(
        "/api/admin/imports/clickup/preview",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source_workspace_id: source,
            list_ids: Object.keys(selected),
          }),
        },
      );
      setPreview(payload);
      setMessage("Preview is ready. Confirm the selected scope to queue the import.");
    } catch (cause) {
      setError(errorMessage("Could not create the migration preview.", cause));
    } finally {
      setLoading(null);
    }
  }

  async function start() {
    if (!preview || loading || (job && !jobFinished)) return;

    setLoading("start");
    setError("");
    setMessage("");
    try {
      const created = await requestJson<Job>(
        "/api/admin/imports/clickup/jobs",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source_workspace_id: source,
            selected_source_ids: Object.values(selected),
            confirmation: true,
          }),
        },
      );
      setJob(created);
      setMessage("Import queued. Use Resume to process the next bounded batch.");
    } catch (cause) {
      if (
        cause instanceof Error &&
        cause.message === "An import is already running for this workspace" &&
        (await restoreExistingJob(undefined, true))
      ) {
        setMessage("The existing migration job has been restored below.");
        return;
      }
      setError(errorMessage("Could not queue the import.", cause));
    } finally {
      setLoading(null);
    }
  }

  async function resume() {
    if (!job || loading) return;

    setLoading("resume");
    setError("");
    try {
      const updated = await requestJson<Job>(
        `/api/admin/imports/clickup/jobs/${job.id}/resume`,
        { method: "POST" },
      );
      setJob(updated);
      setMessage("Migration progress updated.");
    } catch (cause) {
      setError(errorMessage("Could not resume the import.", cause));
    } finally {
      setLoading(null);
    }
  }

  async function cancel() {
    if (!job || loading) return;

    setLoading("cancel");
    setError("");
    try {
      await requestJson(
        `/api/admin/imports/clickup/jobs/${job.id}/cancel`,
        { method: "POST" },
      );
      setJob({ ...job, status: "cancelled" });
      setMessage("Import cancelled.");
    } catch (cause) {
      setError(errorMessage("Could not cancel the import.", cause));
    } finally {
      setLoading(null);
    }
  }

  const busy = loading !== null;
  const selectedCount = Object.keys(selected).length;
  const jobListCount = Array.isArray(job?.selected_source_ids)
    ? job.selected_source_ids.length
    : job?.total ?? 0;
  const retryingFailedLists = Boolean(
    job && job.failed > 0 && job.cursor >= jobListCount,
  );
  const jobFinished = job?.status === "completed" || job?.status === "cancelled";
  const jobCancellable = Boolean(
    job && ["queued", "running", "paused"].includes(job.status),
  );

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">ClickUp migration</h1>
        <p className="text-sm text-muted-foreground">
          Import selected active work into this Upflow workspace. ClickUp
          credentials stay on the server.
        </p>
      </div>

      <section className="space-y-3 rounded-lg border p-4" aria-busy={loading === "hierarchy"}>
        <label className="block text-sm font-medium">
          ClickUp workspace
          <select
            className="mt-1 block w-full rounded border p-2"
            value={source}
            disabled={busy}
            onChange={(event) => selectWorkspace(event.target.value)}
          >
            <option value="">Select workspace</option>
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="rounded bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50"
          disabled={!source || busy}
          onClick={loadHierarchy}
        >
          {loading === "hierarchy" ? "Loading spaces..." : "Load spaces and lists"}
        </button>
      </section>

      {error && (
        <p role="alert" className="rounded border border-destructive/50 p-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm" aria-live="polite">
          {message}
        </p>
      )}

      {hierarchy.length > 0 && (
        <section className="space-y-4 rounded-lg border p-4">
          <h2 className="font-semibold">Select lists</h2>
          {hierarchy.map((item) => (
            <div key={item.space.id}>
              <h3 className="font-medium">{item.space.name}</h3>
              <div className="grid gap-2 pl-4 sm:grid-cols-2">
                {item.lists.map((list) => (
                  <label key={list.id} className="flex gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={Boolean(selected[list.id])}
                      disabled={busy}
                      onChange={() =>
                        toggle({
                          space_id: item.space.id,
                          space_name: item.space.name,
                          list_id: list.id,
                          list_name: list.name,
                        })
                      }
                    />
                    {list.name}
                  </label>
                ))}
                {item.folders.map((folder) => (
                  <div key={folder.id} className="col-span-full">
                    <p className="text-sm font-medium text-muted-foreground">
                      {folder.name}
                    </p>
                    {folder.lists.map((list) => (
                      <label key={list.id} className="ml-4 flex gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={Boolean(selected[list.id])}
                          disabled={busy}
                          onChange={() =>
                            toggle({
                              space_id: item.space.id,
                              space_name: item.space.name,
                              folder_id: folder.id,
                              folder_name: folder.name,
                              list_id: list.id,
                              list_name: list.name,
                            })
                          }
                        />
                        {list.name}
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded border px-3 py-2 disabled:opacity-50"
              disabled={!selectedCount || busy}
              onClick={runPreview}
            >
              {loading === "preview" ? "Building preview..." : "Preview"}
            </button>
            {preview && (
              <button
                type="button"
                className="rounded bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50"
                disabled={busy || Boolean(job && !jobFinished)}
                onClick={start}
              >
                {loading === "start" ? "Queueing import..." : "Confirm and queue import"}
              </button>
            )}
          </div>
          {preview && (
            <p className="text-sm">
              Preview: {preview.lists} lists, {preview.tasks} active tasks,{" "}
              {preview.assignee_emails.length} matched-by-email candidates.
            </p>
          )}
        </section>
      )}

      {job && (
        <section className="space-y-3 rounded-lg border p-4">
          <h2 className="font-semibold">Migration job</h2>
          <p className="text-sm">
            {job.status}: {job.imported} imported, {job.failed} failed,{" "}
            {job.cursor} of {jobListCount} selected lists processed.
          </p>
          {job.failed > 0 && (
            <p role="alert" className="text-sm text-destructive">
              {job.report?.failures?.[0]?.list_name
                ? `${job.report.failures[0].list_name}: ${job.report.failures[0].error}`
                : "Some selected lists failed. Retry them after correcting the reported issue."}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50"
              disabled={jobFinished || busy}
              onClick={resume}
            >
              {loading === "resume"
                ? "Resuming..."
                : retryingFailedLists
                  ? "Retry failed lists"
                  : "Resume next batch"}
            </button>
            <button
              type="button"
              className="rounded border px-3 py-2 disabled:opacity-50"
              disabled={!jobCancellable || busy}
              onClick={cancel}
            >
              {loading === "cancel" ? "Cancelling..." : "Cancel"}
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
