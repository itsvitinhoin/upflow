"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Header from "@/components/layout/header";
import {
  Inbox as InboxIcon,
  UserCheck,
  MessageSquare,
  Clock,
  CheckCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Notification } from "@/lib/types";
import { toast } from "sonner";

type Filter = "all" | "unread" | "assigned" | "commented" | "due_soon";

function iconFor(type: string) {
  if (type === "assigned") return <UserCheck className="w-4 h-4 text-primary" />;
  if (type === "commented")
    return <MessageSquare className="w-4 h-4 text-upflow-success" />;
  return <Clock className="w-4 h-4 text-upflow-warning" />;
}

function labelFor(n: Notification) {
  const taskTitle = n.task?.title || "a task";
  if (n.type === "assigned") return `You were assigned to "${taskTitle}"`;
  if (n.type === "commented") return `New comment on "${taskTitle}"`;
  if (n.type === "due_soon") return `"${taskTitle}" is due soon`;
  return taskTitle;
}

function timeAgo(iso: string) {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = Math.max(0, now - then);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function InboxPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = (await res.json()) as Notification[];
        setNotifications(data);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    return {
      all: notifications.length,
      unread: notifications.filter((n) => !n.read).length,
      assigned: notifications.filter((n) => n.type === "assigned").length,
      commented: notifications.filter((n) => n.type === "commented").length,
      due_soon: notifications.filter((n) => n.type === "due_soon").length,
    };
  }, [notifications]);

  const visible = useMemo(() => {
    if (filter === "all") return notifications;
    if (filter === "unread") return notifications.filter((n) => !n.read);
    return notifications.filter((n) => n.type === filter);
  }, [notifications, filter]);

  const markRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    await fetch(`/api/notifications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read: true }),
    }).catch(() => {});
  };

  const markAllRead = async () => {
    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await Promise.all(
      unread.map((n) =>
        fetch(`/api/notifications/${n.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ read: true }),
        })
      )
    );
    toast.success(`Marked ${unread.length} notification${unread.length === 1 ? "" : "s"} as read`);
  };

  const tabs: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "unread", label: "Unread" },
    { key: "assigned", label: "Assigned" },
    { key: "commented", label: "Comments" },
    { key: "due_soon", label: "Due soon" },
  ];

  return (
    <>
      <Header title="Inbox" />
      <div className="p-6 space-y-4 max-w-3xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            {tabs.map((t) => {
              const active = filter === t.key;
              const count = counts[t.key];
              return (
                <button
                  key={t.key}
                  onClick={() => setFilter(t.key)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-white/5 text-muted-foreground hover:text-foreground hover:bg-white/10"
                  )}
                >
                  {t.label}
                  <span
                    className={cn(
                      "tabular-nums text-[10px] px-1.5 rounded-full",
                      active ? "bg-white/20" : "bg-white/10"
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
          {counts.unread > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Mark all read
            </button>
          )}
        </div>

        <section className="glass rounded-2xl overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              Loading…
            </div>
          ) : visible.length === 0 ? (
            <div className="py-16 text-center">
              <InboxIcon className="w-8 h-8 mx-auto mb-2 text-muted-foreground/60" />
              <p className="text-sm font-medium text-foreground">
                {filter === "unread" ? "No unread notifications" : "Nothing here yet"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {filter === "unread"
                  ? "You're all caught up."
                  : "Mentions, replies, and assignments will appear here."}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-white/5">
              {visible.map((n) => {
                const taskHref = n.task?.project?.id
                  ? `/projects/${n.task.project.id}`
                  : null;
                const Row = (
                  <div
                    className={cn(
                      "flex items-start gap-3 px-5 py-4 transition-colors",
                      !n.read && "bg-primary/5",
                      taskHref && "hover:bg-white/5 cursor-pointer"
                    )}
                  >
                    <div className="mt-0.5 flex-shrink-0">{iconFor(n.type)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground leading-snug">
                        {labelFor(n)}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        {n.task?.project?.name && (
                          <span className="truncate">{n.task.project.name}</span>
                        )}
                        {n.task?.project?.name && <span>·</span>}
                        <span>{timeAgo(n.created_at)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {!n.read && (
                        <>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              markRead(n.id);
                            }}
                            className="text-[11px] text-primary hover:underline"
                          >
                            Mark read
                          </button>
                          <span className="w-2 h-2 rounded-full bg-primary mt-0.5" />
                        </>
                      )}
                    </div>
                  </div>
                );
                return (
                  <li key={n.id}>
                    {taskHref ? (
                      <Link href={taskHref} onClick={() => !n.read && markRead(n.id)}>
                        {Row}
                      </Link>
                    ) : (
                      Row
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
