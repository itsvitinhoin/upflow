export const NOTIFICATION_PREFERENCES_EVENT = "upflow:notification-preferences-changed";

const NOTIFICATION_PREFERENCES_KEY_PREFIX = "upflow:notification-preferences";

export interface NotificationPreferences {
  assistantPopups: boolean;
}

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  assistantPopups: true,
};

function notificationPreferencesKey(userId: string | null | undefined) {
  return userId ? `${NOTIFICATION_PREFERENCES_KEY_PREFIX}:${userId}` : null;
}

export function readNotificationPreferences(
  userId?: string | null,
): NotificationPreferences {
  if (typeof window === "undefined") return DEFAULT_NOTIFICATION_PREFERENCES;
  const key = notificationPreferencesKey(userId);
  if (!key) return DEFAULT_NOTIFICATION_PREFERENCES;

  try {
    const raw = window.localStorage.getItem(key);
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

export function writeNotificationPreferences(
  userId: string | null | undefined,
  next: NotificationPreferences,
) {
  if (typeof window === "undefined") return;
  const key = notificationPreferencesKey(userId);
  if (!key) return;

  window.localStorage.setItem(key, JSON.stringify(next));
  window.dispatchEvent(
    new CustomEvent(NOTIFICATION_PREFERENCES_EVENT, {
      detail: { userId, preferences: next },
    }),
  );
}
