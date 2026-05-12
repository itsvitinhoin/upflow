import Header from "@/components/layout/header";
import { Clock } from "lucide-react";

export default function TimePage() {
  return (
    <>
      <Header title="Time tracking" />
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-card border border-border rounded-2xl p-12 text-center">
          <Clock className="w-10 h-10 mx-auto mb-3 text-muted-foreground/60" />
          <h2 className="text-lg font-semibold text-foreground">Time tracking</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
            Detailed time logs and reports are coming soon. Use the timer in the
            sidebar panel on your dashboard to start tracking work today.
          </p>
        </div>
      </div>
    </>
  );
}
