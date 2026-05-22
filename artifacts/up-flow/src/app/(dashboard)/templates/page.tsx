"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileCheck2, Play } from "lucide-react";
import Header from "@/components/layout/header";
import type { Template } from "@/lib/types";
import type { BuiltInTemplate } from "@/lib/templates";

export default function TemplatesPage() {
  const [builtIns, setBuiltIns] = useState<BuiltInTemplate[]>([]);
  const [saved, setSaved] = useState<Template[]>([]);
  const [applying, setApplying] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/templates")
      .then((res) => res.json() as Promise<{ items: BuiltInTemplate[]; saved: Template[] }>)
      .then((data) => {
        setBuiltIns(data.items ?? []);
        setSaved(data.saved ?? []);
      });
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
        window.location.assign(`/projects/${project.id}`);
      }
    } finally {
      setApplying(null);
    }
  };

  return (
    <>
      <Header title="Templates" />
      <div className="p-6 space-y-6">
        <section>
          <h2 className="text-2xl font-bold text-foreground">Templates</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Apply proven operating routines before broad automation execution.
          </p>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {builtIns.map((template) => (
            <TemplateTile
              key={template.id}
              id={template.id}
              name={template.name}
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
              description={template.description ?? "Workspace template"}
              taskCount={0}
              applying={applying === template.id}
              onApply={applyTemplate}
            />
          ))}
        </section>

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
  description,
  taskCount,
  applying,
  onApply,
}: {
  id: string;
  name: string;
  description: string;
  taskCount: number;
  applying: boolean;
  onApply: (id: string) => void;
}) {
  return (
    <article className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
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
          Apply
        </button>
      </div>
    </article>
  );
}
