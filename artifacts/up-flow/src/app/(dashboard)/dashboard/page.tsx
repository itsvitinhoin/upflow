import { redirect } from "next/navigation";

// Dashboard moved to / — keep this redirect for any old bookmarks.
export default function OldDashboard() {
  redirect("/");
}
