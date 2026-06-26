"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Archive,
  ArrowLeft,
  CheckCircle2,
  Download,
  FileText,
  Printer,
  RefreshCcw,
  Send,
} from "lucide-react";
import Header from "@/components/layout/header";
import { formatDate } from "@/lib/utils";

type ReportStatus =
  | "draft"
  | "internal_review"
  | "ready_for_client"
  | "sent_to_client"
  | "approved"
  | "changes_requested"
  | "completed";

interface ClientReportPayload {
  company: { id: string; name: string; owner?: { name: string; email: string } | null };
  period: { from: string; to: string };
  summary: {
    open_tasks: number;
    completed_tasks: number;
    overdue_tasks: number;
    meetings: number;
    tracked_seconds: number;
    risk_reasons: string[];
    next_deadline: string | null;
  };
  markdown: string;
}

const STATUS_LABEL: Record<ReportStatus, string> = {
  draft: "Draft",
  internal_review: "Internal review",
  ready_for_client: "Ready for client",
  sent_to_client: "Sent to client",
  approved: "Approved",
  changes_requested: "Changes requested",
  completed: "Completed",
};

export default function ClientReportWorkflowPage() {
  const params = useParams();
  const id = (params?.id ?? "") as string;
  const [from, setFrom] = useState(() => toInputDate(daysAgo(7)));
  const [to, setTo] = useState(() => toInputDate(new Date()));
  const [report, setReport] = useState<ClientReportPayload | null>(null);
  const [narrative, setNarrative] = useState("");
  const [status, setStatus] = useState<ReportStatus>("draft");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadReport = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const params = new URLSearchParams({ from, to });
      const res = await fetch(`/api/companies/${id}/report?${params.toString()}`, { cache: "no-store" });
      const payload = (await res.json().catch(() => ({}))) as ClientReportPayload & { error?: string };
      if (!res.ok) throw new Error(payload.error || `Could not load report (${res.status})`);
      setReport(payload);
      setNarrative((current) => current || defaultNarrative(payload));
      setStatus("draft");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load report");
    } finally {
      setLoading(false);
    }
  }, [from, id, to]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const composedMarkdown = useMemo(() => {
    if (!report) return "";
    return [
      report.markdown,
      "",
      "## Internal narrative",
      narrative.trim() || "- No internal narrative added.",
      "",
      `Workflow status: ${STATUS_LABEL[status]}`,
    ].join("\n");
  }, [narrative, report, status]);

  const runAction = async (action: "approve_internal" | "send_to_client" | "archive_report", nextStatus: ReportStatus) => {
    if (!report) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/companies/${id}/report/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          status: nextStatus,
          period: { from: report.period.from, to: report.period.to },
          narrative,
          markdown: composedMarkdown,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(payload.error || `Report action failed (${res.status})`);
      setStatus(nextStatus);
      setMessage(
        action === "approve_internal"
          ? "Report approved internally."
          : action === "send_to_client"
            ? "Report marked as sent to client."
            : "Report archived to client activity.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update report workflow");
    } finally {
      setSaving(false);
    }
  };

  const downloadMarkdown = () => {
    if (!report) return;
    const blob = new Blob([composedMarkdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${report.company.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-client-report.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Header title="Client report" />
      <main className="mx-auto max-w-[1400px] space-y-5 p-4 sm:p-6">
        <section className="rounded-2xl border border-blue-400/20 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.2),transparent_32%),rgba(2,6,23,0.82)] p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <Link href={`/clients/${id}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4" />
                Back to client
              </Link>
              <h1 className="mt-4 text-2xl font-bold text-white">
                {report?.company.name ?? "Client"} report workflow
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                Preview the generated report, edit the internal narrative, approve it, export it, mark it sent, and archive the report in client activity.
              </p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-500/10 px-3 py-1 text-sm font-semibold text-blue-100">
              <FileText className="h-4 w-4" />
              {STATUS_LABEL[status]}
            </span>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              From
              <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="rounded-lg border border-white/10 bg-background px-3 py-2 text-sm text-foreground" />
            </label>
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              To
              <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="rounded-lg border border-white/10 bg-background px-3 py-2 text-sm text-foreground" />
            </label>
            <button type="button" onClick={loadReport} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
              <RefreshCcw className="h-4 w-4" />
              Preview report
            </button>
            <select value={status} onChange={(event) => setStatus(event.target.value as ReportStatus)} className="rounded-lg border border-white/10 bg-background px-3 py-2 text-sm text-foreground">
              {Object.entries(STATUS_LABEL).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </section>

        {error ? <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}
        {message ? <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{message}</div> : null}

        {loading ? (
          <div className="h-96 animate-pulse rounded-2xl bg-white/[0.04]" />
        ) : report ? (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
            <article className="rounded-2xl border border-white/10 bg-[#07101f]/90 p-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <ReportMetric label="Open" value={report.summary.open_tasks} />
                <ReportMetric label="Completed" value={report.summary.completed_tasks} />
                <ReportMetric label="Overdue" value={report.summary.overdue_tasks} danger />
                <ReportMetric label="Meetings" value={report.summary.meetings} />
                <ReportMetric label="Tracked" value={formatSeconds(report.summary.tracked_seconds)} />
              </div>
              <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-base font-semibold text-white">Preview</h2>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(report.period.from)} - {formatDate(report.period.to)}
                  </p>
                </div>
                <pre className="max-h-[680px] overflow-auto whitespace-pre-wrap rounded-lg bg-black/25 p-4 text-sm leading-6 text-blue-50/85">
                  {composedMarkdown}
                </pre>
              </div>
            </article>

            <aside className="space-y-4">
              <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <h2 className="text-sm font-semibold text-white">Narrative editor</h2>
                <textarea
                  value={narrative}
                  onChange={(event) => setNarrative(event.target.value)}
                  rows={12}
                  className="mt-3 w-full rounded-xl border border-white/10 bg-background px-3 py-2 text-sm leading-6 text-foreground outline-none focus:ring-2 focus:ring-primary/40"
                />
              </section>

              <section className="grid gap-2 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <button disabled={saving} onClick={() => runAction("approve_internal", "approved")} className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                  <CheckCircle2 className="h-4 w-4" />
                  Approve internally
                </button>
                <button disabled={saving} onClick={downloadMarkdown} className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-blue-100 disabled:opacity-60">
                  <Download className="h-4 w-4" />
                  Export markdown
                </button>
                <button disabled={saving} onClick={() => window.print()} className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-blue-100 disabled:opacity-60">
                  <Printer className="h-4 w-4" />
                  Export PDF
                </button>
                <button disabled={saving} onClick={() => runAction("send_to_client", "sent_to_client")} className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
                  <Send className="h-4 w-4" />
                  Mark sent to client
                </button>
                <button disabled={saving} onClick={() => runAction("archive_report", "completed")} className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-blue-100 disabled:opacity-60">
                  <Archive className="h-4 w-4" />
                  Archive report history
                </button>
              </section>
            </aside>
          </div>
        ) : null}
      </main>
    </>
  );
}

function ReportMetric({ label, value, danger = false }: { label: string; value: string | number; danger?: boolean }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className={danger ? "mt-2 text-2xl font-bold text-rose-300" : "mt-2 text-2xl font-bold text-white"}>{value}</p>
    </div>
  );
}

function defaultNarrative(report: ClientReportPayload) {
  const risk = report.summary.risk_reasons.length
    ? `Risks to address: ${report.summary.risk_reasons.join(", ")}.`
    : "No major risk signals appeared in this period.";
  return [
    `${report.company.name} completed ${report.summary.completed_tasks} tasks with ${report.summary.open_tasks} still open.`,
    risk,
    report.summary.next_deadline ? `Next deadline: ${formatDate(report.summary.next_deadline)}.` : "No next deadline is currently set.",
  ].join("\n\n");
}

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function toInputDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatSeconds(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
