"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  CheckSquare,
  Folder,
  FileText,
  Search as SearchIcon,
  Loader2,
} from "lucide-react";
import Header from "@/components/layout/header";
import { cn, statusColor, statusLabel } from "@/lib/utils";

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
interface SearchResponse {
  q: string;
  tasks: SearchTask[];
  projects: SearchProject[];
  docs: SearchDoc[];
}

function SearchResults() {
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

  const total = (data?.tasks.length ?? 0) + (data?.projects.length ?? 0) + (data?.docs.length ?? 0);

  return (
    <>
      <Header title="Search" />
      <div className="px-6 py-8 max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <SearchIcon className="w-5 h-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold">
            {q ? <>Results for &ldquo;{q}&rdquo;</> : "Search"}
          </h1>
          {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        </div>

        {!q && (
          <p className="text-sm text-muted-foreground">
            Use the search bar at the top, or press <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded">⌘K</kbd> to open the command palette.
          </p>
        )}

        {q && !loading && total === 0 && (
          <div className="py-16 text-center text-sm text-muted-foreground">
            No matches found.
          </div>
        )}

        {data && data.projects.length > 0 && (
          <Section title="Projects" count={data.projects.length}>
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
                      {statusLabel(p.status)}
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

        {data && data.tasks.length > 0 && (
          <Section title="Tasks" count={data.tasks.length}>
            {data.tasks.map((t) => (
              <Link
                key={t.id}
                href={t.project ? `/projects/${t.project.id}?task=${t.id}` : "/projects"}
                className="flex items-start gap-3 px-4 py-3 rounded-lg hover:bg-muted/50 transition-colors border border-transparent hover:border-border"
              >
                <CheckSquare className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm truncate block">{t.title}</span>
                  {t.project?.name && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {t.project.name}
                    </p>
                  )}
                </div>
                <span className={cn("text-xs px-1.5 py-0.5 rounded flex-shrink-0", statusColor(t.status))}>
                  {statusLabel(t.status)}
                </span>
              </Link>
            ))}
          </Section>
        )}

        {data && data.docs.length > 0 && (
          <Section title="Docs" count={data.docs.length}>
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
  return (
    <Suspense fallback={<div className="px-6 py-8 text-sm text-muted-foreground">Loading…</div>}>
      <SearchResults />
    </Suspense>
  );
}
