import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background p-6">
      <div
        data-testid="not-found"
        className="w-full max-w-md rounded-xl border border-border bg-card/60 p-8 text-center shadow-xl backdrop-blur"
      >
        <div className="mx-auto mb-4 inline-flex rounded-full bg-primary/15 p-3 text-primary">
          <Compass className="h-6 w-6" aria-hidden />
        </div>
        <h1 className="mb-2 text-xl font-semibold text-foreground">
          Page not found
        </h1>
        <p className="mb-6 text-sm text-muted-foreground">
          The page you were looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
