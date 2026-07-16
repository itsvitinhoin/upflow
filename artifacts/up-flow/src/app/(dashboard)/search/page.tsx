"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  CheckSquare,
  Building2,
  Folder,
  FileText,
  Hash,
  Search as SearchIcon,
  Loader2,
} from "lucide-react";
import Header from "@/components/layout/header";
import { useLanguage } from "@/components/language-provider";
import { cn, statusColor, statusLabel } from "@/lib/utils";

interface SearchTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  project: SearchProjectContext | null;
}
interface SearchProjectContext {
  id: string;
  name: string;
  kind: "client" | "internal" | "operational_queue" | "onboarding";
  company: { id: string; name: string } | null;
  space: { id: string; name: string; icon: string | null } | null;
  folder: { id: string; name: string; icon: string | null } | null;
}
interface SearchProject {
  id: string;
  name: string;
  description: string | null;
  status: string;
  kind: SearchProjectContext["kind"];
  company: SearchProjectContext["company"];
  space: { id: string; name: string; icon: string | null } | null;
  folder: SearchProjectContext["folder"];
}
interface SearchDoc {
  id: string;
  title: string;
  project: SearchProjectContext | null;
}
interface SearchSpace {
  id: string;
  name: string;
  icon: string | null;
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
  spaces: SearchSpace[];
  tasks: SearchTask[];
  projects: SearchProject[];
  docs: SearchDoc[];
  companies: SearchCompany[];
}

function projectContext(project: SearchProjectContext | SearchProject | null | undefined) {
  if (!project) return "";
  return [project.company?.name, project.space?.name, project.folder?.name]
    .filter(Boolean)
    .join(" › ");
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
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setData(null);
    setLoading(true);
    fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!controller.signal.aborted) setData(d);
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setData(null);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [q]);

  const total =
    (data?.spaces.length ?? 0) +
    (data?.tasks.length ?? 0) +
    (data?.projects.length ?? 0) +
    (data?.docs.length ?? 0) +
    (data?.companies.length ?? 0);

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
            {t("search.hintBeforeShortcut")} {" "}
            <kbd className="rounded bg-muted px-1.5 py-0.5 text-xs">Ctrl/Cmd K</kbd>{" "}
            {t("search.hintAfterShortcut")}
          </p>
        )}

        {q && !loading && total === 0 && (
          <div className="py-16 text-center text-sm text-muted-foreground">
            {t("search.noMatches")}
          </div>
        )}

        {data && data.spaces.length > 0 && (
          <Section title={t("search.spaces")} count={data.spaces.length}>
            {data.spaces.map((space) => (
              <Link
                key={space.id}
                href={`/spaces/${space.id}`}
                className="flex items-center gap-3 rounded-lg border border-transparent px-4 py-3 transition-colors hover:border-border hover:bg-muted/50"
              >
                <Hash className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <span className="truncate text-sm font-medium">{space.name}</span>
              </Link>
            ))}
          </Section>
        )}

        {data && data.projects.length > 0 && (
          <Section title={t("search.projects")} count={data.projects.length}>
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
                    {p.kind === "onboarding" && (
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                        {t("search.onboarding")}
                      </span>
                    )}
                  </div>
                  {p.description && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {p.description}
                    </p>
                  )}
                  {projectContext(p) && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {projectContext(p)}
                    </p>
                  )}
                </div>
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
          <Section title={t("search.tasks")} count={data.tasks.length}>
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
          <Section title={t("search.docs")} count={data.docs.length}>
            {data.docs.map((d) => (
              <Link
                key={d.id}
                href={`/docs/${d.id}`}
                className="flex items-start gap-3 px-4 py-3 rounded-lg hover:bg-muted/50 transition-colors border border-transparent hover:border-border"
              >
                <FileText className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm truncate block">{d.title}</span>
                  {d.project && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {[d.project.name, projectContext(d.project)].filter(Boolean).join(" · ")}
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
  return (
    <Suspense fallback={<SearchLoading />}>
      <SearchResults />
    </Suspense>
  );
}

function SearchLoading() {
  const { t } = useLanguage();
  return <div className="px-4 py-6 text-sm text-muted-foreground sm:px-6 sm:py-8">{t("common.loading")}</div>;
}
