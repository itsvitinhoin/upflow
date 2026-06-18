import type { Notification } from "@/lib/types";

export function getNotificationHref(notification: Notification): string | null {
  if (notification.task?.project?.id) {
    const params = new URLSearchParams({ task: notification.task.id });
    return `/projects/${notification.task.project.id}?${params.toString()}`;
  }

  if (notification.type === "member_joined") {
    return "/team";
  }

  return null;
}
