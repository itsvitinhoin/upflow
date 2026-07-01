import type { Notification } from "@/lib/types";

export function getNotificationHref(notification: Notification): string | null {
  const data = notification.data as { source?: string; company_id?: string } | null;
  if (data?.source?.startsWith("client_onboarding") && data.company_id) {
    return `/clients/${data.company_id}`;
  }

  if (notification.task?.project?.id) {
    const params = new URLSearchParams({ task: notification.task.id });
    return `/projects/${notification.task.project.id}?${params.toString()}`;
  }

  if (notification.type === "member_joined") {
    return "/team";
  }

  return null;
}
