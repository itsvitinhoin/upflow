"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";
import * as Sentry from "@sentry/nextjs";

/**
 * Segment-level error boundary for the dashboard group. Because it lives
 * INSIDE `app/(dashboard)/layout.tsx`, Next renders this in place of the
 * failing page while keeping the sidebar/header from the parent layout
 * mounted. The top-level `app/error.tsx` only kicks in for failures
 * outside the dashboard (login, invite, etc.).
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex h-full w-full items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-border bg-card/60 p-8 shadow-xl backdrop-blur">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-full bg-destructive/15 p-2 text-destructive">
            <AlertTriangle className="h-5 w-5" aria-hidden />
          </div>
          <h1 className="text-lg font-semibold text-foreground">
            Something went wrong
          </h1>
        </div>
        <p className="mb-6 text-sm text-muted-foreground">
          We hit an unexpected error loading this page. Our team has been
          notified — you can try again or head back to your dashboard.
        </p>
        {error.digest ? (
          <p className="mb-6 break-all text-xs text-muted-foreground/70">
            Reference: <span className="font-mono">{error.digest}</span>
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
