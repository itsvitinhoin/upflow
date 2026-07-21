"use client";

import { useId, useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { TeamMember } from "@/lib/types";

type BackupOwnersPickerProps = {
  value: string[];
  users: TeamMember[];
  selectableUsers: TeamMember[];
  department: string;
  disabled: boolean;
  onChange: (nextValue: string[]) => void;
};

export default function BackupOwnersPicker({
  value,
  users,
  selectableUsers,
  department,
  disabled,
  onChange,
}: BackupOwnersPickerProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const id = useId();
  const listId = `${id}-backup-owners`;
  const statusId = `${id}-backup-status`;
  const selectedUsers = value.flatMap((userId) => {
    const user = users.find((candidate) => candidate.id === userId);
    return user ? [user] : [];
  });
  const summary = value.length === 0
    ? t("onboardingWorkflow.selectBackups")
    : selectedUsers[0]
      ? value.length === 1
        ? selectedUsers[0].name
        : t("onboardingWorkflow.backupOwnersSummary", {
          name: selectedUsers[0].name,
          count: value.length - 1,
        })
      : t("onboardingWorkflow.backupOwnersSelected", { count: value.length });

  const toggleUser = (userId: string) => {
    onChange(value.includes(userId) ? value.filter((id) => id !== userId) : [...value, userId]);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        if (!disabled) setOpen(nextOpen);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid="backup-owners-picker"
          aria-expanded={open}
          aria-controls={listId}
          aria-describedby={statusId}
          aria-label={t("onboardingWorkflow.backupOwnersForDepartment", { department })}
          disabled={disabled}
          className="flex min-h-10 w-full min-w-0 items-center gap-2 rounded-lg border border-border/70 bg-background px-3 py-2 text-left text-sm font-semibold text-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="min-w-0 flex-1 truncate">{summary}</span>
          <ChevronsUpDown aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-[280px] overflow-hidden p-0">
        <Command>
          <CommandInput placeholder={t("onboardingWorkflow.searchBackupOwners")} />
          <CommandList id={listId}>
            <CommandEmpty>{t("onboardingWorkflow.noBackupOwners")}</CommandEmpty>
            {value.length > 0 ? (
              <>
                <CommandGroup>
                  <CommandItem value="clear backup owners" onSelect={() => onChange([])}>
                    <X aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
                    <span>{t("onboardingWorkflow.clearBackups")}</span>
                  </CommandItem>
                </CommandGroup>
                <CommandSeparator />
              </>
            ) : null}
            <CommandGroup heading={t("onboardingWorkflow.backupResponsible")}>
              {selectableUsers.map((user) => {
                const isSelected = value.includes(user.id);
                return (
                  <CommandItem
                    key={user.id}
                    value={`${user.name} ${user.email} ${user.id}`}
                    onSelect={() => toggleUser(user.id)}
                    aria-selected={isSelected}
                    className="py-2"
                  >
                    <span
                      aria-hidden="true"
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border text-transparent"
                      }`}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{user.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
      <span id={statusId} className="sr-only" aria-live="polite">
        {value.length > 0
          ? t("onboardingWorkflow.backupOwnersSelected", { count: value.length })
          : t("onboardingWorkflow.selectBackups")}
      </span>
    </Popover>
  );
}
