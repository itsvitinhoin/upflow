"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { FileText, Plus, Clock } from "lucide-react";
import Header from "@/components/layout/header";
import { formatDate } from "@/lib/utils";
import type { Doc } from "@/lib/types";
import { useLanguage } from "@/components/language-provider";

export default function DocsPage() {
  const { language, t } = useLanguage();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/docs")
      .then((r) => r.json())
      .then((data: { items: Doc[] }) => {
        setDocs(data.items ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleNew = async () => {
    const res = await fetch("/api/docs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: t("docs.untitled") }),
    });
    if (res.ok) {
      const doc = await res.json() as Doc;
      window.location.href = `/docs/${doc.id}`;
    } else {
      toast.error(t("docs.createFailed"));
    }
  };

  return (
    <>
      <Header title={t("docs.title")} />
      <div className="mx-auto max-w-4xl overflow-x-hidden p-4 sm:p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-foreground">{t("docs.documents")}</h2>
            <p className="text-muted-foreground text-sm mt-0.5">
              {t(docs.length === 1 ? "docs.countOne" : "docs.countOther", { count: docs.length })}
            </p>
          </div>
          <button
            onClick={handleNew}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" /> {t("docs.new")}
          </button>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : docs.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">{t("docs.emptyTitle")}</p>
            <p className="text-sm mt-1">{t("docs.emptyBody")}</p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="border-b border-border">
                <tr>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">
                    {t("docs.documentTitle")}
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 hidden sm:table-cell">
                    {t("docs.project")}
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 hidden md:table-cell">
                    {t("docs.lastUpdated")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {docs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/docs/${doc.id}`} className="flex items-center gap-3 group">
                        <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                          {doc.title}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-sm text-muted-foreground">
                        {doc.project?.name || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {formatDate(doc.updated_at, language === "pt-BR" ? "pt-BR" : "en-US")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
