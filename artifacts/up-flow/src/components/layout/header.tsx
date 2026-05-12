"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus, Bell, UserCheck, MessageSquare, Clock } from "lucide-react";
import NewProjectDialog from "@/components/projects/new-project-dialog";
import { useAppUser } from "@/components/user-provider";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Notification } from "@/lib/types";

interface HeaderProps {
  title: string;
}

function notificationIcon(type: string) {
  if (type === "assigned") return <UserCheck className="w-3.5 h-3.5 text-primary" />;
  if (type === "commented") return <MessageSquare className="w-3.5 h-3.5 text-upflow-success" />;
  return <Clock className="w-3.5 h-3.5 text-upflow-warning" />;
}

function notificationLabel(n: Notification) {
  const taskTitle = n.task?.title || "a task";
  if (n.type === "assigned") return `Assigned to "${taskTitle}"`;
  if (n.type === "commented") return `New comment on "${taskTitle}"`;
  if (n.type === "due_soon") return `"${taskTitle}" is due soon`;
  return taskTitle;
}

export default function Header({ title }: HeaderProps) {
  const router = useRouter();
  const user = useAppUser();
  const [search, setSearch] = useState("");
  const [showNewProject, setShowNewProject] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = (await res.json()) as Notification[];
        setNotifications(data);
        setUnreadCount(data.filter((n) => !n.read).length);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    fetchNotifications();
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
        () => fetchNotifications()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchNotifications]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setPanelOpen(false);
      }
    }
    if (panelOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
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
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (search.trim()) {
        router.push(`/projects?search=${encodeURIComponent(search.trim())}`);
      }
    },
    [search, router]
  );

  return (
    <>
      <header className="flex items-center justify-between gap-4 px-6 py-4 border-b border-border bg-background/80 backdrop-blur sticky top-0 z-30">
        <h1 className="text-base font-semibold text-foreground md:ml-0 ml-10 truncate">
          {title}
        </h1>

        <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects, tasks, docs…"
              className="w-full h-10 pl-10 pr-4 text-sm bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent placeholder:text-muted-foreground transition"
            />
          </div>
        </form>

        <div className="flex items-center gap-2">
          <div className="relative" ref={panelRef}>
            <button
              onClick={() => setPanelOpen((v) => !v)}
              aria-label="Notifications"
              className="relative w-10 h-10 flex items-center justify-center rounded-xl bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
            >
              <Bell className="w-[18px] h-[18px]" />
              {unreadCount > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-upflow-danger ring-2 ring-background" />
              )}
            </button>

            {panelOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-popover border border-border rounded-xl shadow-2xl z-50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <span className="text-sm font-semibold text-foreground">
                    Notifications
                  </span>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-xs text-primary hover:underline"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-border">
                  {notifications.length === 0 ? (
                    <div className="py-10 text-center text-sm text-muted-foreground">
                      You&apos;re all caught up
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        className={cn(
                          "flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors",
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
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => setShowNewProject(true)}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium px-4 h-10 rounded-xl transition-colors shadow-md shadow-primary/20"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Project</span>
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
    </>
  );
}
