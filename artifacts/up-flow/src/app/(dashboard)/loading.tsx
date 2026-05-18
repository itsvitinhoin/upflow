/**
 * Dashboard-segment loader. Renders *inside* the dashboard layout so the
 * sidebar/header stay mounted while the page-level RSC stream is in
 * flight, instead of flashing a blank screen.
 */
export default function DashboardLoading() {
  return (
    <div
      className="space-y-4 p-6"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">Loading…</span>
      <div className="h-7 w-48 animate-pulse rounded-md bg-muted/60" />
      <div className="h-4 w-72 animate-pulse rounded-md bg-muted/40" />
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-xl border border-border bg-card/40"
          />
        ))}
      </div>
    </div>
  );
}
