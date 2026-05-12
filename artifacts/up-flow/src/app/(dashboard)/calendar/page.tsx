import Header from "@/components/layout/header";
import { Calendar } from "lucide-react";

export default function CalendarPage() {
  return (
    <>
      <Header title="Calendar" />
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-card border border-border rounded-2xl p-12 text-center">
          <Calendar className="w-10 h-10 mx-auto mb-3 text-muted-foreground/60" />
          <h2 className="text-lg font-semibold text-foreground">Calendar</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
            A full team calendar view is coming soon. For now you can see today&apos;s
            timeline and meetings on the dashboard.
          </p>
        </div>
      </div>
    </>
  );
}
