"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Zap, LayoutDashboard, FolderOpen, FileText, Users,
  Bell, LogOut, Menu, X, ChevronRight, UserCheck, MessageSquare, Clock
} from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { AppUser, Notification } from "@/lib/types";

interface SidebarProps {
  user: AppUser;
}

const navLinks = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderOpen },
  { href: "/docs", label: "Docs", icon: FileText },
  { href: "/team", label: "Team", icon: Users },
];

function notificationIcon(type: string) {
  if (type === "assigned") return <UserCheck className="w-3.5 h-3.5 text-blue-400" />;
  if (type === "commented") return <MessageSquare className="w-3.5 h-3.5 text-purple-400" />;
  return <Clock className="w-3.5 h-3.5 text-orange-400" />;
}

function notificationLabel(n: Notification) {
  const taskTitle = n.task?.title || "a task";
  if (n.type === "assigned") return `Assigned to "${taskTitle}"`;
  if (n.type === "commented") return `New comment on "${taskTitle}"`;
  if (n.type === "due_soon") return `"${taskTitle}" is due soon`;
  return taskTitle;
}

export default function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json() as Notification[];
        setNotifications(data);
        setUnreadCount(data.filter((n) => !n.read).length);
      }
    } catch {
    }
  }, []);

  useEffect(() => {
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
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchNotifications, user.id]);

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

  const handleSignOut = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    toast.success("Signed out");
    router.push("/login");
    router.refresh();
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-sidebar-border">
        <div className="flex items-center justify-center w-8 h-8 bg-sidebar-primary rounded-lg">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <span className="text-lg font-bold text-sidebar-foreground">Up Flow</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navLinks.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/"
              ? pathname === "/"
              : pathname === href || (pathname?.startsWith(href + "/") ?? false);
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
              {isActive && <ChevronRight className="w-3 h-3 ml-auto" />}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 pb-4 space-y-1 border-t border-sidebar-border pt-4">
        <div className="relative" ref={panelRef}>
          <button
            onClick={() => setPanelOpen((v) => !v)}
            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
          >
            <div className="relative">
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold leading-none">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </div>
            Notifications
          </button>

          {panelOpen && (
            <div className="absolute bottom-full left-0 mb-2 w-72 bg-popover border border-border rounded-xl shadow-2xl z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <span className="text-sm font-semibold text-foreground">Notifications</span>
                {unreadCount > 0 && (
                  <button onClick={handleMarkAllRead} className="text-xs text-primary hover:underline">
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-border">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">No notifications</div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={cn(
                        "flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors",
                        !n.read && "bg-primary/5"
                      )}
                    >
                      <div className="mt-0.5 flex-shrink-0">{notificationIcon(n.type)}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-foreground leading-snug">{notificationLabel(n)}</p>
                        {n.task?.project?.name && (
                          <p className="text-xs text-muted-foreground mt-0.5">{n.task.project.name}</p>
                        )}
                      </div>
                      {!n.read && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg">
          <div className="flex items-center justify-center w-8 h-8 bg-sidebar-primary rounded-full text-xs font-bold text-white flex-shrink-0">
            {getInitials(user.name || user.email || "U")}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {user.name || user.email}
            </p>
            <p className="text-xs text-sidebar-foreground/50 capitalize truncate">{user.role}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors flex-shrink-0"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden md:flex w-60 flex-shrink-0 flex-col h-full border-r border-sidebar-border">
        <SidebarContent />
      </aside>

      <div className="md:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="bg-sidebar text-sidebar-foreground p-2 rounded-lg shadow-lg"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {mobileOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-black/50 z-40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="md:hidden fixed left-0 top-0 h-full w-60 z-50 shadow-2xl">
            <SidebarContent />
          </aside>
        </>
      )}
    </>
  );
}
