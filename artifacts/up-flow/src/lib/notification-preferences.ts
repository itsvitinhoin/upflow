export const NOTIFICATION_PREFERENCES_EVENT = "upflow:notification-preferences-changed";

const NOTIFICATION_PREFERENCES_KEY = "upflow:notification-preferences";

export interface NotificationPreferences {
  assistantPopups: boolean;
}

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  assistantPopups: true,
};

export function readNotificationPreferences(): NotificationPreferences {
  if (typeof window === "undefined") return DEFAULT_NOTIFICATION_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(NOTIFICATION_PREFERENCES_KEY);
    if (!raw) return DEFAULT_NOTIFICATION_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<NotificationPreferences>;
    return {
      assistantPopups:
        typeof parsed.assistantPopups === "boolean"
          ? parsed.assistantPopups
          : DEFAULT_NOTIFICATION_PREFERENCES.assistantPopups,
    };
  } catch {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }
}

export function writeNotificationPreferences(next: NotificationPreferences) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(NOTIFICATION_PREFERENCES_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(NOTIFICATION_PREFERENCES_EVENT, { detail: next }));
}
