"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus, Bell, UserCheck, MessageSquare, Clock, UserPlus, ArrowRightCircle, AtSign, Languages, Sparkles, X, Moon, Sun } from "lucide-react";
import NewProjectDialog from "@/components/projects/new-project-dialog";
import CommandPalette from "@/components/command-palette";
import { useAppUser } from "@/components/user-provider";
import { useLanguage } from "@/components/language-provider";
import { useTheme } from "@/components/theme-provider";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getCachedJson } from "@/lib/client-cache";
import { getNotificationHref } from "@/lib/notification-links";
import { memberJoinedNotificationLabel } from "@/lib/notification-copy";
import {
  NOTIFICATION_PREFERENCES_EVENT,
  readNotificationPreferences,
  type NotificationPreferences,
} from "@/lib/notification-preferences";
import { cn } from "@/lib/utils";
import type { Notification } from "@/lib/types";

interface HeaderProps {
  title: string;
}

const NOTIFICATION_CACHE_TTL_MS = 30_000;
let notificationCache: { items: Notification[]; loadedAt: number } | null = null;
let notificationRequest: Promise<Notification[]> | null = null;

function fetchUnreadCount(force = false): Promise<number> {
  return getCachedJson<{ unread: number }>(
    "notifications:unread-count",
    "/api/notifications/unread-count",
    { ttlMs: 30_000, force },
  )
    .then((data) => data.unread ?? 0)
    .catch(() => 0);
}

function fetchNotificationItems(force = false): Promise<Notification[]> {
  if (
    !force &&
    notificationCache &&
    Date.now() - notificationCache.loadedAt < NOTIFICATION_CACHE_TTL_MS
  ) {
    return Promise.resolve(notificationCache.items);
  }
  if (!force && notificationRequest) return notificationRequest;

  notificationRequest = fetch("/api/notifications")
    .then(async (res) => {
      if (!res.ok) return [];
      const data = (await res.json()) as { items: Notification[] };
      const items = data.items ?? [];
      notificationCache = { items, loadedAt: Date.now() };
      return items;
    })
    .catch(() => [])
    .finally(() => {
      notificationRequest = null;
    });

  return notificationRequest;
}

const STATUS_LABEL: Record<string, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
};

function notificationIcon(type: string) {
  if (type === "assigned") return <UserCheck className="w-3.5 h-3.5 text-primary" />;
  if (type === "commented") return <MessageSquare className="w-3.5 h-3.5 text-upflow-success" />;
  if (type === "member_joined") return <UserPlus className="w-3.5 h-3.5 text-primary" />;
  if (type === "status_changed") return <ArrowRightCircle className="w-3.5 h-3.5 text-primary" />;
  if (type === "mentioned") return <AtSign className="w-3.5 h-3.5 text-upflow-success" />;
  return <Clock className="w-3.5 h-3.5 text-upflow-warning" />;
}

function notificationData(n: Notification): Record<string, unknown> {
  return n.data && typeof n.data === "object"
    ? (n.data as Record<string, unknown>)
    : {};
}

function getStringData(data: Record<string, unknown>, key: string) {
  const value = data[key];
  return typeof value === "string" ? value : undefined;
}

function calendarAssignmentLabel(
  type: string | undefined,
  language: "en" | "pt" | "pt-BR",
) {
  const isMeeting = type === "meeting";
  if (language === "en") return isMeeting ? "meeting" : "calendar event";
  return isMeeting ? "reuniao" : "evento";
}

function notificationContext(n: Notification, language: "en" | "pt" | "pt-BR") {
  const data = notificationData(n);
  if (data.source === "calendar_event_assigned") {
    const startsAt = getStringData(data, "starts_at");
    if (startsAt) {
      const date = new Date(startsAt);
      if (!Number.isNaN(date.getTime())) {
        return new Intl.DateTimeFormat(language, {
          dateStyle: "short",
          timeStyle: "short",
        }).format(date);
      }
    }
    return n.workspace?.name ?? (language === "en" ? "Calendar" : "Calendario");
  }

  return n.task?.project?.name ?? n.workspace?.name ?? null;
}

function shouldShowAssistantPopup(n: Notification) {
  if (n.read || n.type !== "assigned") return false;
  const data = notificationData(n);
  return Boolean(n.task?.id || data.source === "calendar_event_assigned");
}

function notificationLabel(n: Notification, language: "en" | "pt" | "pt-BR" = "en") {
  if (n.type === "member_joined") {
    return memberJoinedNotificationLabel(n, language);
  }
  const data = notificationData(n);
  if (data.source === "calendar_event_assigned") {
    const eventTitle = getStringData(data, "calendar_event_title") ?? "event";
    const eventType = calendarAssignmentLabel(
      getStringData(data, "calendar_event_type"),
      language,
    );
    return language === "en"
      ? `Assigned to ${eventType} "${eventTitle}"`
      : `Atribuido a ${eventType} "${eventTitle}"`;
  }
  const taskTitle = n.task?.title || getStringData(data, "task_title") || "a task";
  if (n.type === "assigned") {
    return language === "en"
      ? `Assigned to "${taskTitle}"`
      : `Atribuido a "${taskTitle}"`;
  }
  if (n.type === "commented") {
    return language === "en"
      ? `New comment on "${taskTitle}"`
      : `Novo comentario em "${taskTitle}"`;
  }
  if (n.type === "due_soon") {
    return language === "en"
      ? `"${taskTitle}" is due soon`
      : `"${taskTitle}" vence em breve`;
  }
  if (n.type === "status_changed") {
    const actor = getStringData(data, "actor_name") || (language === "en" ? "Someone" : "Alguem");
    const newStatus = getStringData(data, "new_status");
    const newLabel = newStatus ? STATUS_LABEL[newStatus] ?? newStatus : "a new status";
    return `${actor} moved "${taskTitle}" to ${newLabel}`;
  }
  if (n.type === "mentioned") {
    const data = notificationData(n);
    const actor = getStringData(data, "actor_name") || (language === "en" ? "Someone" : "Alguem");
    return `${actor} mentioned you on "${taskTitle}"`;
  }
  return taskTitle;
}

export default function Header({ title }: HeaderProps) {
  const router = useRouter();
  const user = useAppUser();
  const { language, toggleLanguage, t } = useLanguage();
  const { theme, setTheme } = useTheme();
  const isDark = theme !== "light";
  const [search, setSearch] = useState("");
  const [showNewProject, setShowNewProject] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);
  const [assistantNotification, setAssistantNotification] = useState<Notification | null>(null);
  const [notificationPreferences, setNotificationPreferences] =
    useState<NotificationPreferences>(() => readNotificationPreferences());
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const shownAssistantIdsRef = useRef<Set<string>>(new Set());
  const canCreateProject =
    user?.isSuperAdmin ||
    user?.currentRole === "owner" ||
    user?.currentRole === "admin";

  const fetchNotifications = useCallback(async (
    force = false,
    options?: { showAssistant?: boolean },
  ) => {
    const items = await fetchNotificationItems(force);
    setNotifications(items);
    setUnreadCount(items.filter((n) => !n.read).length);
    if (options?.showAssistant && notificationPreferences.assistantPopups) {
      const nextNotification = items.find(
        (item) =>
          shouldShowAssistantPopup(item) &&
          !shownAssistantIdsRef.current.has(item.id),
      );
      if (nextNotification) {
        shownAssistantIdsRef.current.add(nextNotification.id);
        setAssistantNotification(nextNotification);
      }
    }
  }, [notificationPreferences.assistantPopups]);

  useEffect(() => {
    const onPreferencesChanged = () => {
      setNotificationPreferences(readNotificationPreferences());
    };
    window.addEventListener(NOTIFICATION_PREFERENCES_EVENT, onPreferencesChanged);
    window.addEventListener("storage", onPreferencesChanged);
    return () => {
      window.removeEventListener(NOTIFICATION_PREFERENCES_EVENT, onPreferencesChanged);
      window.removeEventListener("storage", onPreferencesChanged);
    };
  }, []);

  const refreshUnreadCount = useCallback(async (force = false) => {
    const count = await fetchUnreadCount(force);
    setUnreadCount(count);
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    fetchNotifications(true, { showAssistant: true });
    const supabase = createSupabaseBrowserClient();
    const handleIncomingNotification = (showAssistant: boolean) => {
      refreshUnreadCount(true);
      fetchNotifications(true, { showAssistant });
    };
    const fallbackPoll = window.setInterval(() => {
      fetchNotifications(true, { showAssistant: true });
    }, 30_000);
    const dbChannel = supabase
      .channel(`db-notifications:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          handleIncomingNotification(payload.eventType === "INSERT");
        },
      )
      .subscribe();
    const broadcastChannel = supabase
      .channel(`notifications:${user.id}`)
      .on("broadcast", { event: "new_notification" }, () => {
        handleIncomingNotification(true);
      })
      .subscribe();
    return () => {
      window.clearInterval(fallbackPoll);
      supabase.removeChannel(dbChannel);
      supabase.removeChannel(broadcastChannel);
    };
  }, [user?.id, fetchNotifications, refreshUnreadCount]);

  useEffect(() => {
    if (panelOpen) fetchNotifications();
  }, [panelOpen, fetchNotifications]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setPanelOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape" && panelOpen) setPanelOpen(false);
    }
    if (panelOpen) {
      document.addEventListener("mousedown", handleClick);
      document.addEventListener("keydown", handleKey);
    }
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [panelOpen]);


  const handleMarkAllRead = async () => {
    const unread = notifications.filter((n) => !n.read);
    await Promise.all(
      unread.map((n) =>
        fetch(`/api/notifications/${n.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ read: true }),
        })
      )
    );
    setUnreadCount(0);
    setNotifications((prev) => {
      const next = prev.map((n) => ({ ...n, read: true }));
      notificationCache = { items: next, loadedAt: Date.now() };
      return next;
    });
  };

  const handleOpenNotification = async (notification: Notification) => {
    const href = getNotificationHref(notification);
    if (!notification.read) {
      setUnreadCount((count) => Math.max(0, count - 1));
      setNotifications((prev) => {
        const next = prev.map((n) =>
          n.id === notification.id ? { ...n, read: true } : n,
        );
        notificationCache = { items: next, loadedAt: Date.now() };
        return next;
      });
      fetch(`/api/notifications/${notification.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ read: true }),
      }).catch(() => {
        fetchNotifications(true);
        refreshUnreadCount(true);
      });
    }

    if (href) {
      setPanelOpen(false);
      router.push(href);
    }
  };

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (search.trim()) {
        router.push(`/search?q=${encodeURIComponent(search.trim())}`);
      }
    },
    [search, router]
  );

  const assistantContext = assistantNotification
    ? notificationContext(assistantNotification, language)
    : null;

  return (
    <>
      <header className="sticky top-0 z-30 flex min-h-20 flex-col gap-3 px-4 py-3 glass-header sm:flex-row sm:items-center sm:gap-4 sm:px-6">
        <form
          onSubmit={handleSearch}
          action="/search"
          method="get"
          className="w-full min-w-0 pl-11 sm:flex-1 md:pl-0"
          aria-label={`Search ${title}`}
        >
          <div className="relative w-full">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={searchRef}
              type="search"
              name="q"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("header.searchPlaceholder", {
                title: title.toLowerCase(),
              })}
              className="upflow-shell-search upflow-focus-glow h-10 w-full rounded-full border border-blue-300/10 bg-[#050a18]/80 pl-11 pr-4 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_30px_rgba(37,99,235,0.08)] backdrop-blur-md transition placeholder:text-muted-foreground hover:border-blue-300/25 hover:bg-[#070d1f]/90 focus:border-sky-400/70 sm:h-11 md:pr-16"
            />
            <kbd className="upflow-shell-kbd absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-1 rounded-lg border border-blue-300/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-muted-foreground md:flex">
              Ctrl K
            </kbd>
          </div>
        </form>

        <div className="flex flex-shrink-0 items-center justify-end gap-2 sm:self-auto">
          <button
            type="button"
            onClick={toggleLanguage}
            aria-label={t("language.toggle")}
            title={`${t("language.toggle")}: ${
              language === "en"
                ? t("language.portugueseBrazil")
                : t("language.english")
            }`}
            className="upflow-shell-control inline-flex h-10 items-center gap-1.5 rounded-full border border-blue-300/10 bg-[#071024]/80 px-2.5 text-xs font-semibold text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-md transition-all hover:border-sky-400/45 hover:bg-sky-400/10 hover:text-foreground hover:shadow-[0_0_24px_rgba(59,130,246,0.16)] sm:h-11 sm:px-3"
          >
            <Languages className="h-4 w-4" />
            <span>{language === "en" ? "EN" : "PT"}</span>
          </button>
          <button
            type="button"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            className="upflow-shell-control inline-flex h-10 w-10 items-center justify-center rounded-full border border-blue-300/10 bg-[#071024]/80 text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-md transition-all hover:border-sky-400/45 hover:bg-sky-400/10 hover:text-foreground hover:shadow-[0_0_24px_rgba(59,130,246,0.16)] sm:h-11 sm:w-11"
          >
            {isDark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
          </button>
          <div className="relative" ref={panelRef}>
            <button
              onClick={() => setPanelOpen((v) => !v)}
              aria-label={t("header.notifications")}
              className="upflow-shell-control relative flex h-10 w-10 items-center justify-center rounded-full border border-blue-300/10 bg-[#071024]/80 text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-md transition-all hover:border-sky-400/45 hover:bg-sky-400/10 hover:text-foreground hover:shadow-[0_0_24px_rgba(59,130,246,0.16)] sm:h-11 sm:w-11"
            >
              <Bell className="w-[18px] h-[18px]" />
              {unreadCount > 0 && (
                <span className="upflow-pulse-badge absolute right-2 top-2 h-2 w-2 rounded-full bg-upflow-danger ring-2 ring-background" />
              )}
            </button>

            {panelOpen && (
              <div className="fixed left-4 right-4 top-16 z-50 overflow-hidden rounded-xl glass-strong sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <span className="text-sm font-semibold text-foreground">
                    {t("header.notifications")}
                  </span>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-xs text-primary hover:underline"
                    >
                      {t("header.markAllRead")}
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-border">
                  {notifications.length === 0 ? (
                    <div className="py-10 text-center text-sm text-muted-foreground">
                      {t("header.allCaughtUp")}
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <button
                        type="button"
                        key={n.id}
                        onClick={() => handleOpenNotification(n)}
                        className={cn(
                          "flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors",
                          !n.read && "bg-primary/5"
                        )}
                      >
                        <div className="mt-0.5 flex-shrink-0">
                          {notificationIcon(n.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-foreground leading-snug">
                            {notificationLabel(n, language)}
                          </p>
                          {notificationContext(n, language) && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              {notificationContext(n, language)}
                            </p>
                          )}
                        </div>
                        {!n.read && (
                          <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {canCreateProject && (
            <button
              onClick={() => setShowNewProject(true)}
              aria-label={t("header.newProject")}
              className="upflow-gradient-button flex h-10 items-center gap-2 rounded-full px-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 sm:h-11 sm:px-5"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">{t("header.newProject")}</span>
            </button>
          )}
        </div>
      </header>

      {assistantNotification && (
        <div
          role="alert"
          aria-live="assertive"
          className="fixed right-4 top-24 z-[60] w-[calc(100vw-2rem)] max-w-sm overflow-hidden rounded-2xl border border-sky-300/60 bg-[#071024]/95 p-4 text-foreground shadow-[0_0_0_1px_rgba(125,211,252,0.25),0_24px_90px_rgba(37,99,235,0.52)] backdrop-blur-xl"
        >
          <span className="pointer-events-none absolute inset-0 animate-pulse bg-[radial-gradient(circle_at_12%_0%,rgba(96,165,250,0.32),transparent_34%),radial-gradient(circle_at_100%_0%,rgba(14,165,233,0.26),transparent_32%)]" />
          <span className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 animate-ping rounded-full bg-sky-400/20" />
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary ring-1 ring-sky-300/40">
                <span className="absolute inset-0 animate-ping rounded-xl bg-sky-400/20" />
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-primary">
                  {t("header.assistantEyebrow")}
                </p>
                <p className="truncate text-sm font-semibold">
                  {t("header.assistantTitle")}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAssistantNotification(null)}
              aria-label={t("header.assistantDismiss")}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-white/10 hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-sm font-medium leading-snug">
            {notificationLabel(assistantNotification, language)}
          </p>
          {assistantContext && (
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {assistantContext}
            </p>
          )}
          <p className="relative mt-3 rounded-lg border border-sky-300/15 bg-sky-400/10 px-3 py-2 text-xs font-medium text-sky-100">
            {t("header.assistantStickyHint")}
          </p>
          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setAssistantNotification(null)}
              className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:bg-white/10 hover:text-foreground"
            >
              {t("header.assistantDismiss")}
            </button>
            <button
              type="button"
              onClick={() => {
                const notification = assistantNotification;
                setAssistantNotification(null);
                if (notification) void handleOpenNotification(notification);
              }}
              className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90"
            >
              {t("header.assistantOpen")}
            </button>
          </div>
        </div>
      )}

      <NewProjectDialog
        open={showNewProject}
        onClose={() => setShowNewProject(false)}
        onCreated={(project) => {
          setShowNewProject(false);
          router.push(`/projects/${project.id}`);
        }}
      />

      <CommandPalette />
    </>
  );
}
