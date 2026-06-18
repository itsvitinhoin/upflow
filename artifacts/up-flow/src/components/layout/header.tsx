"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus, Bell, UserCheck, MessageSquare, Clock, UserPlus, ArrowRightCircle, AtSign, Languages } from "lucide-react";
import NewProjectDialog from "@/components/projects/new-project-dialog";
import CommandPalette from "@/components/command-palette";
import { useAppUser } from "@/components/user-provider";
import { useLanguage } from "@/components/language-provider";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getCachedJson } from "@/lib/client-cache";
import { getNotificationHref } from "@/lib/notification-links";
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

function notificationLabel(n: Notification) {
  if (n.type === "member_joined") {
    const data = (n.data ?? {}) as { new_member_name?: string; new_member_email?: string };
    const who = data.new_member_name || data.new_member_email || "Someone";
    const where = n.workspace?.name ? ` joined ${n.workspace.name}` : " joined the workspace";
    return `${who}${where}`;
  }
  const taskTitle = n.task?.title || "a task";
  if (n.type === "assigned") return `Assigned to "${taskTitle}"`;
  if (n.type === "commented") return `New comment on "${taskTitle}"`;
  if (n.type === "due_soon") return `"${taskTitle}" is due soon`;
  if (n.type === "status_changed") {
    const data = (n.data ?? {}) as { new_status?: string; actor_name?: string };
    const actor = data.actor_name || "Someone";
    const newLabel = data.new_status ? STATUS_LABEL[data.new_status] ?? data.new_status : "a new status";
    return `${actor} moved "${taskTitle}" to ${newLabel}`;
  }
  if (n.type === "mentioned") {
    const data = (n.data ?? {}) as { actor_name?: string };
    const actor = data.actor_name || "Someone";
    return `${actor} mentioned you on "${taskTitle}"`;
  }
  return taskTitle;
}

export default function Header({ title }: HeaderProps) {
  const router = useRouter();
  const user = useAppUser();
  const { language, toggleLanguage, t } = useLanguage();
  const [search, setSearch] = useState("");
  const [showNewProject, setShowNewProject] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const fetchNotifications = useCallback(async (force = false) => {
    const items = await fetchNotificationItems(force);
    setNotifications(items);
    setUnreadCount(items.filter((n) => !n.read).length);
  }, []);

  const refreshUnreadCount = useCallback(async (force = false) => {
    const count = await fetchUnreadCount(force);
    setUnreadCount(count);
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    refreshUnreadCount();
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`db-notifications:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          refreshUnreadCount(true);
          if (panelOpen) fetchNotifications(true);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchNotifications, panelOpen, refreshUnreadCount]);

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

  return (
    <>
      <header className="sticky top-0 z-30 flex flex-col gap-3 px-4 py-3 glass-header sm:flex-row sm:items-center sm:gap-4 sm:px-6">
        <form
          onSubmit={handleSearch}
          className="w-full min-w-0 pl-11 sm:flex-1 md:pl-0"
          aria-label={`Search ${title}`}
        >
          <div className="relative w-full">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={searchRef}
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("header.searchPlaceholder", {
                title: title.toLowerCase(),
              })}
              className="upflow-focus-glow h-10 w-full rounded-full border border-blue-300/10 bg-[#050a18]/80 pl-11 pr-4 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_30px_rgba(37,99,235,0.08)] backdrop-blur-md transition placeholder:text-muted-foreground hover:border-blue-300/25 hover:bg-[#070d1f]/90 focus:border-sky-400/70 sm:h-11 md:pr-16"
            />
            <kbd className="absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-1 rounded-lg border border-blue-300/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-muted-foreground md:flex">
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
            className="inline-flex h-10 items-center gap-1.5 rounded-full border border-blue-300/10 bg-[#071024]/80 px-2.5 text-xs font-semibold text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-md transition-all hover:border-sky-400/45 hover:bg-sky-400/10 hover:text-foreground hover:shadow-[0_0_24px_rgba(59,130,246,0.16)] sm:h-11 sm:px-3"
          >
            <Languages className="h-4 w-4" />
            <span>{language === "en" ? "EN" : "PT"}</span>
          </button>
          <div className="relative" ref={panelRef}>
            <button
              onClick={() => setPanelOpen((v) => !v)}
              aria-label={t("header.notifications")}
              className="relative flex h-10 w-10 items-center justify-center rounded-full border border-blue-300/10 bg-[#071024]/80 text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-md transition-all hover:border-sky-400/45 hover:bg-sky-400/10 hover:text-foreground hover:shadow-[0_0_24px_rgba(59,130,246,0.16)] sm:h-11 sm:w-11"
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
                            {notificationLabel(n)}
                          </p>
                          {n.task?.project?.name && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {n.task.project.name}
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

          <button
            onClick={() => setShowNewProject(true)}
            aria-label={t("header.newProject")}
            className="upflow-gradient-button flex h-10 items-center gap-2 rounded-full px-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 sm:h-11 sm:px-5"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">{t("header.newProject")}</span>
          </button>
        </div>
      </header>

      <NewProjectDialog
        open={showNewProject}
        onClose={() => setShowNewProject(false)}
        onCreated={() => {
          setShowNewProject(false);
          router.refresh();
        }}
      />

      <CommandPalette />
    </>
  );
}
