import Header from "@/components/layout/header";
import { Inbox } from "lucide-react";

export default function InboxPage() {
  return (
    <>
      <Header title="Inbox" />
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-card border border-border rounded-2xl p-12 text-center">
          <Inbox className="w-10 h-10 mx-auto mb-3 text-muted-foreground/60" />
          <h2 className="text-lg font-semibold text-foreground">Inbox</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
            Mentions, replies, and assignments will land here. For now, use the
            bell in the top bar to see your latest notifications.
          </p>
        </div>
      </div>
    </>
  );
}
