"use client";

import { useState, useEffect } from "react";
import { Users } from "lucide-react";
import Header from "@/components/layout/header";
import { cn, getInitials } from "@/lib/utils";
import type { TeamMember } from "@/lib/types";

export default function TeamPage() {
  const [users, setUsers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((data: { items: TeamMember[] }) => {
        setUsers(data.items ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <>
      <Header title="Team" />
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-foreground">Team Members</h2>
          <p className="text-muted-foreground text-sm mt-0.5">
            {users.length} member{users.length !== 1 ? "s" : ""}
          </p>
        </div>

        {loading ? (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center gap-4 px-6 py-4 border-b border-border last:border-0"
              >
                <div className="w-10 h-10 rounded-full bg-muted animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-32 animate-pulse" />
                  <div className="h-3 bg-muted rounded w-48 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No team members yet</p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="border-b border-border">
                <tr>
                  <th className="text-left text-xs font-medium text-muted-foreground px-6 py-3">
                    Member
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-6 py-3 hidden sm:table-cell">
                    Email
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-6 py-3">
                    Role
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 text-primary text-sm font-bold flex items-center justify-center flex-shrink-0">
                          {getInitials(user.name)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{user.name}</p>
                          <p className="text-xs text-muted-foreground sm:hidden">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 hidden sm:table-cell">
                      <span className="text-sm text-muted-foreground">{user.email}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={cn(
                          "text-xs px-2.5 py-1 rounded-full font-medium capitalize",
                          user.role === "admin"
                            ? "bg-primary/15 text-primary"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {user.role}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
