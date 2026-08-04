"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, UserPlus, UsersRound, X } from "lucide-react";
import { toast } from "sonner";

import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Contributor {
  user_id: string;
  role: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

interface EligibleMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface MembersResponse {
  canManageMembers: boolean;
  project: {
    id: string;
    name: string;
    owner_id: string | null;
  };
  members: Contributor[];
  eligibleMembers: EligibleMember[];
}

interface ProjectMembersDialogProps {
  open: boolean;
  projectId: string;
  onClose: () => void;
  onChanged?: () => void;
}

export default function ProjectMembersDialog({
  open,
  projectId,
  onClose,
  onChanged,
}: ProjectMembersDialogProps) {
  const { t } = useLanguage();
  const [data, setData] = useState<MembersResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState("");

  const loadMembers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/members`);
      if (!response.ok) throw new Error();
      setData((await response.json()) as MembersResponse);
    } catch {
      toast.error(t("projects.failedToLoad"));
    } finally {
      setLoading(false);
    }
  }, [projectId, t]);

  useEffect(() => {
    if (!open) return;
    void loadMembers();
  }, [loadMembers, open]);

  const availableMembers = useMemo(() => {
    if (!data) return [];
    const contributorIds = new Set(data.members.map((member) => member.user_id));
    return data.eligibleMembers.filter(
      (member) => member.id !== data.project.owner_id && !contributorIds.has(member.id),
    );
  }, [data]);

  const addContributor = async () => {
    if (!selectedUserId || pendingUserId || !data?.canManageMembers) return;
    setPendingUserId(selectedUserId);
    try {
      const response = await fetch(`/api/projects/${projectId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: selectedUserId }),
      });
      if (!response.ok) throw new Error();
      setSelectedUserId("");
      await loadMembers();
      onChanged?.();
    } catch {
      toast.error(t("projects.failedToLoad"));
    } finally {
      setPendingUserId(null);
    }
  };

  const removeContributor = async (userId: string) => {
    if (pendingUserId || !data?.canManageMembers) return;
    setPendingUserId(userId);
    try {
      const response = await fetch(`/api/projects/${projectId}/members/${userId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error();
      await loadMembers();
      onChanged?.();
    } catch {
      toast.error(t("projects.failedToLoad"));
    } finally {
      setPendingUserId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-8">
            <UsersRound className="h-5 w-5 text-primary" />
            {t("projects.projectContributors")}
          </DialogTitle>
          <DialogDescription>{t("projects.contributorAccessDescription")}</DialogDescription>
        </DialogHeader>

        {loading && !data ? (
          <div className="flex min-h-40 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : data ? (
          <div className="space-y-4">
            <p className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-950 dark:text-amber-100">
              {t("projects.restrictedContributorHint")}
            </p>

            <div className="rounded-xl border border-border bg-muted/25 p-3">
              <p className="mb-2 text-sm font-semibold text-foreground">
                {t("projects.projectContributors")}
              </p>
              {data.members.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("projects.noContributors")}</p>
              ) : (
                <ul className="space-y-2">
                  {data.members.map((member) => (
                    <li
                      key={member.user_id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {member.user.name}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {member.user.email}
                        </span>
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => void removeContributor(member.user_id)}
                        disabled={Boolean(pendingUserId)}
                        className="shrink-0 text-destructive hover:text-destructive"
                      >
                        {pendingUserId === member.user_id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <X className="h-3.5 w-3.5" />
                        )}
                        {t("projects.removeContributor")}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {data.canManageMembers && (
              <div className="flex flex-col gap-2 sm:flex-row">
                <select
                  value={selectedUserId}
                  onChange={(event) => setSelectedUserId(event.target.value)}
                  disabled={availableMembers.length === 0 || Boolean(pendingUserId)}
                  className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm text-foreground"
                >
                  <option value="">{t("projects.addContributor")}</option>
                  {availableMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name} - {member.email}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  onClick={() => void addContributor()}
                  disabled={!selectedUserId || Boolean(pendingUserId)}
                  className="shrink-0"
                >
                  {pendingUserId === selectedUserId ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UserPlus className="h-4 w-4" />
                  )}
                  {t("projects.addContributor")}
                </Button>
              </div>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
