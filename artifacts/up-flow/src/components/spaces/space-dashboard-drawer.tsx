"use client";

import Link from "next/link";
import { Calendar as CalendarIcon, CheckSquare, FolderPlus, X } from "lucide-react";
import type { Task } from "@/lib/types";
import {
  drawerTitle,
  entrySeconds,
  formatDateTime,
  formatSecondsShort,
  humanize,
  statusTitle,
  type DrawerKind,
  type TaskStatus,
} from "@/components/spaces/space-dashboard-utils";
import type { SpaceDashboardData } from "@/components/spaces/space-page-types";
import {
  Metric,
  QuickCreateButton,
  RecordList,
  TaskRecord,
} from "@/components/spaces/space-dashboard-parts";

export function SpaceDashboardDrawer({
  kind,
  data,
  updatingTask,
  onClose,
  onCreateTask,
  onCreateMeeting,
  onCreateProject,
  onTaskStatusChange,
}: {
  kind: DrawerKind;
  data: SpaceDashboardData;
  updatingTask: boolean;
  onClose: () => void;
  onCreateTask: () => void;
  onCreateMeeting: () => void;
  onCreateProject: () => void;
  onTaskStatusChange: (task: Task, status: TaskStatus) => void;
}) {
  const status = kind.startsWith("status:") ? (kind.split(":")[1] as TaskStatus) : null;
  const statusTasks = status
    ? data.tasks.items.filter((task) => task.status === status)
    : [];
  const title = status ? statusTitle(status) : drawerTitle(kind);

  return (
    <div className="fixed inset-0 z-50">
      <button
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close drawer"
      />
      <aside className="glass-strong absolute right-0 top-0 flex h-dvh w-full max-w-xl flex-col border-l border-white/10 shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div>
            <p className="text-xs uppercase text-muted-foreground">Space dashboard</p>
            <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {kind === "urgent_actions" && (
            <RecordList
              emptyTitle="No urgent actions"
              emptyText="Due, overdue, and high-priority assigned tasks appear here."
            >
              {data.command_center.urgent_actions.items.map((task) => (
                <TaskRecord
                  key={task.id}
                  task={task}
                  updating={updatingTask}
                  onStatusChange={onTaskStatusChange}
                />
              ))}
            </RecordList>
          )}

          {status && (
            <RecordList
              emptyTitle={`No ${status.replace("_", " ")} tasks`}
              emptyText="Tasks with this status will appear here."
            >
              {statusTasks.map((task) => (
                <TaskRecord
                  key={task.id}
                  task={task}
                  updating={updatingTask}
                  onStatusChange={onTaskStatusChange}
                />
              ))}
            </RecordList>
          )}

          {kind === "team_workload" && (
            <RecordList emptyTitle="No team workload" emptyText="Assigned Space tasks appear here.">
              {data.command_center.team_workload.items.map((item) => (
                <div key={item.user.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.user.name}</p>
                      <p className="text-xs text-muted-foreground">{item.user.email}</p>
                    </div>
                    <span className="rounded-full border border-white/10 px-2 py-1 text-xs capitalize text-muted-foreground">
                      {item.state}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                    <Metric label="Open" value={item.open_tasks} />
                    <Metric label="Overdue" value={item.overdue_tasks} />
                    <Metric label="Today" value={formatSecondsShort(item.tracked_seconds_today)} />
                  </div>
                  {item.tasks.length > 0 ? (
                    <div className="mt-3 space-y-2 border-t border-white/5 pt-3">
                      {item.tasks.map((task) => (
                        <TaskRecord
                          key={task.id}
                          task={task}
                          updating={updatingTask}
                          onStatusChange={onTaskStatusChange}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 rounded-lg bg-black/10 px-3 py-2 text-xs text-muted-foreground">
                      No open assigned tasks behind this workload signal.
                    </p>
                  )}
                </div>
              ))}
            </RecordList>
          )}

          {kind === "time_today" && (
            <RecordList emptyTitle="No time tracked today" emptyText="Space-linked time entries appear here.">
              {data.command_center.time_today.entries.map((entry) => (
                <div key={entry.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {entry.description || entry.task?.title || entry.project?.name || "Time entry"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {entry.project?.name || "No project"} - {formatDateTime(entry.started_at)}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-foreground">
                      {formatSecondsShort(entrySeconds(entry))}
                    </span>
                  </div>
                </div>
              ))}
            </RecordList>
          )}

          {kind === "meetings_today" && (
            <RecordList emptyTitle="No meetings today" emptyText="Space-linked calendar events appear here.">
              {data.command_center.meetings_today.items.map((event) => (
                <div key={event.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-sm font-medium text-foreground">{event.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDateTime(event.starts_at)}
                    {event.location ? ` - ${event.location}` : ""}
                  </p>
                </div>
              ))}
            </RecordList>
          )}

          {kind === "recent_activity" && (
            <RecordList emptyTitle="No recent activity" emptyText="Space activity appears here.">
              {data.command_center.recent_activity.items.map((event) => (
                <div key={event.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-sm font-medium text-foreground">{humanize(event.type)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {event.actor?.name || "System"} - {formatDateTime(event.created_at)}
                  </p>
                </div>
              ))}
            </RecordList>
          )}

          {kind === "projects_at_risk" && (
            <RecordList
              emptyTitle="No projects at risk"
              emptyText="Projects appear here only when they have overdue open tasks, no owner, or no activity record in 7 days."
            >
              {data.command_center.projects_at_risk.items.map(({ project, reasons }) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="block rounded-lg border border-white/10 bg-white/[0.03] p-4 hover:bg-white/[0.06]"
                >
                  <p className="text-sm font-medium text-foreground">{project.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{reasons.join(" - ")}</p>
                </Link>
              ))}
            </RecordList>
          )}

          {kind === "quick_create" && (
            <div className="grid gap-2">
              <QuickCreateButton icon={<CheckSquare className="h-4 w-4" />} onClick={onCreateTask}>
                New task
              </QuickCreateButton>
              <QuickCreateButton icon={<CalendarIcon className="h-4 w-4" />} onClick={onCreateMeeting}>
                New meeting
              </QuickCreateButton>
              <QuickCreateButton icon={<FolderPlus className="h-4 w-4" />} onClick={onCreateProject}>
                New project
              </QuickCreateButton>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
