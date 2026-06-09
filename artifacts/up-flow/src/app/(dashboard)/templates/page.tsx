"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, FileCheck2, Play, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import Header from "@/components/layout/header";
import type { Template } from "@/lib/types";
import type { BuiltInTemplate } from "@/lib/templates";

export default function TemplatesPage() {
  const [builtIns, setBuiltIns] = useState<BuiltInTemplate[]>([]);
  const [saved, setSaved] = useState<Template[]>([]);
  const [applying, setApplying] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadTemplates = () => {
    setLoading(true);
    setError("");
    fetch("/api/templates")
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as {
          items?: BuiltInTemplate[];
          saved?: Template[];
          error?: string;
        };
        if (!res.ok) throw new Error(data.error || `Could not load templates (${res.status})`);
        return data;
      })
      .then((data) => {
        setBuiltIns(data.items ?? []);
        setSaved(data.saved ?? []);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Could not load agency templates");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const applyTemplate = async (id: string) => {
    setApplying(id);
    try {
      const res = await fetch(`/api/templates/${id}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const project = (await res.json()) as { id: string };
        toast.success("Agency playbook applied");
        window.location.assign(`/projects/${project.id}`);
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Could not apply this template");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not apply this template");
    } finally {
      setApplying(null);
    }
  };

  return (
    <>
      <Header title="Templates" />
      <div className="p-6 space-y-6">
        <section>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Agency playbooks
          </p>
          <h2 className="mt-2 text-2xl font-bold text-foreground">Agency workflow templates</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Launch repeatable client operations for onboarding, paid media, content, creative production, reports, reviews, and finance.
          </p>
        </section>

        {loading ? (
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <div key={item} className="h-36 animate-pulse rounded-xl bg-white/5" />
            ))}
          </section>
        ) : error ? (
          <section className="rounded-xl border border-upflow-danger/30 bg-upflow-danger/10 p-5">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-1 h-5 w-5 flex-shrink-0 text-upflow-danger" />
              <div>
                <h3 className="text-sm font-semibold text-foreground">Could not load agency templates</h3>
                <p className="mt-1 text-sm text-muted-foreground">{error}</p>
                <button
                  type="button"
                  onClick={loadTemplates}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <RefreshCcw className="h-3.5 w-3.5" />
                  Retry
                </button>
              </div>
            </div>
          </section>
        ) : builtIns.length === 0 && saved.length === 0 ? (
          <section className="rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center">
            <FileCheck2 className="mx-auto h-8 w-8 text-muted-foreground" />
            <h3 className="mt-3 text-sm font-semibold text-foreground">No agency playbooks yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Built-in agency templates will appear here once the templates API is available.
            </p>
          </section>
        ) : (
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {builtIns.map((template) => (
              <TemplateTile
                key={template.id}
                id={template.id}
                name={template.name}
                type={template.type}
                description={template.description}
                taskCount={template.config.tasks.length}
                applying={applying === template.id}
                onApply={applyTemplate}
              />
            ))}
            {saved.map((template) => (
              <TemplateTile
                key={template.id}
                id={template.id}
                name={template.name}
                type={template.type}
                description={template.description ?? "Workspace template"}
                taskCount={0}
                applying={applying === template.id}
                onApply={applyTemplate}
              />
            ))}
          </section>
        )}

        <Link href="/" className="text-xs text-muted-foreground hover:text-foreground">
          Back to Command Center
        </Link>
      </div>
    </>
  );
}

function TemplateTile({
  id,
  name,
  type,
  description,
  taskCount,
  applying,
  onApply,
}: {
  id: string;
  name: string;
  type: string;
  description: string;
  taskCount: number;
  applying: boolean;
  onApply: (id: string) => void;
}) {
  return (
    <article className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
            {formatTemplateType(type)}
          </span>
          <h3 className="text-sm font-semibold text-foreground">{name}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        <FileCheck2 className="h-5 w-5 text-primary" />
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">
          {taskCount ? `${taskCount} starter tasks` : "Custom workflow"}
        </span>
        <button
          type="button"
          onClick={() => onApply(id)}
          disabled={applying}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Play className="h-3.5 w-3.5" />
          {applying ? "Applying..." : "Apply"}
        </button>
      </div>
    </article>
  );
}

function formatTemplateType(type: string) {
  return type.replaceAll("_", " ").replace(/^\w/, (letter) => letter.toUpperCase());
}
