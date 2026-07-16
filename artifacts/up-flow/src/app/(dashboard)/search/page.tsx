"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  CheckSquare,
  Building2,
  Folder,
  FileText,
  Search as SearchIcon,
  Loader2,
} from "lucide-react";
import Header from "@/components/layout/header";
import { cn, statusColor, statusLabel } from "@/lib/utils";
import { useLanguage } from "@/components/language-provider";

interface SearchTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  project: { id: string; name: string } | null;
}
interface SearchProject {
  id: string;
  name: string;
  description: string | null;
  status: string;
  space: { id: string; name: string; icon: string | null } | null;
}
interface SearchDoc {
  id: string;
  title: string;
  project: { id: string; name: string } | null;
}
interface SearchCompany {
  id: string;
  name: string;
  status: string;
  plan_name: string | null;
  owner: { id: string; name: string } | null;
}
interface SearchResponse {
  q: string;
  tasks: SearchTask[];
  projects: SearchProject[];
  docs: SearchDoc[];
  companies: SearchCompany[];
}

function SearchResults() {
  const { t } = useLanguage();
  const params = useSearchParams();
  const q = params?.get("q") ?? "";
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!q) {
      setData(null);
      return;
    }
    setLoading(true);
    fetch(`/api/search?q=${encodeURIComponent(q)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, [q]);

  const total = (data?.tasks.length ?? 0) + (data?.projects.length ?? 0) + (data?.docs.length ?? 0) + (data?.companies.length ?? 0);

  return (
    <>
      <Header title={t("search.title")} />
      <div className="max-w-4xl overflow-x-hidden px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex items-center gap-3 mb-6">
          <SearchIcon className="w-5 h-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold">
            {q ? t("search.resultsFor", { query: q }) : t("search.title")}
          </h1>
          {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        </div>

        {!q && (
          <p className="text-sm text-muted-foreground">
            {t("search.hint", { shortcut: "Ctrl K" })}
          </p>
        )}

        {q && !loading && total === 0 && (
          <div className="py-16 text-center text-sm text-muted-foreground">
            {t("search.noMatches")}
          </div>
        )}

        {data && data.projects.length > 0 && (
          <Section title={t("nav.projects")} count={data.projects.length}>
            {data.projects.map((p) => (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="flex items-start gap-3 px-4 py-3 rounded-lg hover:bg-muted/50 transition-colors border border-transparent hover:border-border"
              >
                <Folder className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{p.name}</span>
                    <span className={cn("text-xs px-1.5 py-0.5 rounded", statusColor(p.status))}>
                      {statusLabel(p.status, t)}
                    </span>
                  </div>
                  {p.description && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {p.description}
                    </p>
                  )}
                </div>
                {p.space?.name && (
                  <span className="text-xs text-muted-foreground flex-shrink-0">{p.space.name}</span>
                )}
              </Link>
            ))}
          </Section>
        )}

        {data && data.companies.length > 0 && (
          <Section title={t("clients.title")} count={data.companies.length}>
            {data.companies.map((company) => (
              <Link
                key={company.id}
                href={`/clients/${company.id}`}
                className="flex items-start gap-3 px-4 py-3 rounded-lg hover:bg-muted/50 transition-colors border border-transparent hover:border-border"
              >
                <Building2 className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium truncate block">{company.name}</span>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {[company.plan_name, company.owner?.name].filter(Boolean).join(" / ") || company.status}
                  </p>
                </div>
              </Link>
            ))}
          </Section>
        )}

        {data && data.tasks.length > 0 && (
          <Section title={t("command.myTasks")} count={data.tasks.length}>
            {data.tasks.map((task) => (
              <Link
                key={task.id}
                href={task.project ? `/projects/${task.project.id}?task=${task.id}` : "/projects"}
                className="flex items-start gap-3 px-4 py-3 rounded-lg hover:bg-muted/50 transition-colors border border-transparent hover:border-border"
              >
                <CheckSquare className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm truncate block">{task.title}</span>
                  {task.project?.name && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {task.project.name}
                    </p>
                  )}
                </div>
                <span className={cn("text-xs px-1.5 py-0.5 rounded flex-shrink-0", statusColor(task.status))}>
                  {statusLabel(task.status, t)}
                </span>
              </Link>
            ))}
          </Section>
        )}

        {data && data.docs.length > 0 && (
          <Section title={t("docs.title")} count={data.docs.length}>
            {data.docs.map((d) => (
              <Link
                key={d.id}
                href={`/docs/${d.id}`}
                className="flex items-start gap-3 px-4 py-3 rounded-lg hover:bg-muted/50 transition-colors border border-transparent hover:border-border"
              >
                <FileText className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm truncate block">{d.title}</span>
                  {d.project?.name && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {d.project.name}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </Section>
        )}
      </div>
    </>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
        {title}
        <span className="text-muted-foreground/60">{count}</span>
      </h2>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

export default function SearchPage() {
  const { t } = useLanguage();
  return (
    <Suspense fallback={<div className="px-4 py-6 text-sm text-muted-foreground sm:px-6 sm:py-8">{t("common.loading")}</div>}>
      <SearchResults />
    </Suspense>
  );
}
