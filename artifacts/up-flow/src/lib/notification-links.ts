import type { Notification } from "@/lib/types";

export function getNotificationHref(notification: Notification): string | null {
  const data = notification.data as {
    source?: string;
    company_id?: string;
    calendar_event_id?: string;
    starts_at?: string;
  } | null;

  if (notification.task?.project?.id) {
    const params = new URLSearchParams({ task: notification.task.id });
    return `/projects/${notification.task.project.id}?${params.toString()}`;
  }

  if (data?.source === "calendar_event_assigned" && data.calendar_event_id) {
    const params = new URLSearchParams({ event: data.calendar_event_id });
    if (data.starts_at) params.set("date", data.starts_at.slice(0, 10));
    return `/calendar?${params.toString()}`;
  }

  if (data?.source?.startsWith("client_onboarding") && data.company_id) {
    return `/clients/${data.company_id}`;
  }

  if (notification.type === "member_joined") {
    return "/team";
  }

  return null;
}
