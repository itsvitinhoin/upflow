"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { ArrowLeft, Building2, Loader2 } from "lucide-react";
import Header from "@/components/layout/header";
import ClientOnboardingPanel from "@/components/onboarding/client-onboarding-panel";
import { useLanguage } from "@/components/language-provider";
import type { Company } from "@/lib/types";

export default function OnboardingWorkflowPage() {
  const { t } = useLanguage();
  const params = useParams();
  const companyId = (params?.companyId ?? "") as string;
  const [company, setCompany] = useState<Partial<Company> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;

    const loadCompany = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/companies/${companyId}`, { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as Partial<Company>;
        if (!cancelled) setCompany(payload);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadCompany();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  if (!companyId) notFound();

  if (loading) {
    return (
      <>
        <Header title={t("onboardingQueue.title")} />
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </>
    );
  }

  if (!company) notFound();

  return (
    <>
      <Header title={company.name || t("onboardingQueue.title")} />
      <main className="space-y-4 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link
            href="/onboarding"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("onboardingQueue.title")}
          </Link>
          <Link
            href={`/clients/${companyId}`}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/60"
          >
            <Building2 className="h-4 w-4" />
            {t("clients.openClient")}
          </Link>
        </div>

        <ClientOnboardingPanel companyId={companyId} company={company} />
      </main>
    </>
  );
}
