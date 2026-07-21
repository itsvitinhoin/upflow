"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { APP_TIME_ZONE, cn } from "@/lib/utils";
import type { CustomFieldDefinition, Task, TaskAssignee } from "@/lib/types";

const FIELD_NAMES = {
  contentType: "Content Type",
  contentStatus: "Creative Production Status",
  approvalStatus: "Approval Status",
  publishingStatus: "Publishing Status",
  socialManager: "Social Media Manager",
  designer: "Designer",
  publishedUrl: "Published URL",
  publishedAt: "Published At",
} as const;

const MOODBOARD_STATUSES = [
  "Not Started",
  "In Progress",
  "Ready",
  "Awaiting Approval",
  "Approved",
];
const CONTENT_STATUSES = [
  "Not Requested",
  "In Production",
  "In Review",
  "Awaiting Approval",
  "Approved",
  "Scheduled",
];
const APPROVAL_STATUSES = [
  "Not Requested",
  "Awaiting Approval",
  "Approved",
  "Changes Requested",
];
const PUBLISHING_STATUSES = [
  "Not Scheduled",
  "Scheduled",
  "Published",
  "Overdue",
  "Cancelled",
];

type Company = { id: string; name: string };

type MoodboardTask = {
  id: string;
  title: string;
  status: Task["status"];
  due_date?: string | null;
} | null;

type SocialMediaContentTask = {
  id: string;
  title: string;
  status: Task["status"];
  priority: Task["priority"];
  due_date: string | null;
  scheduled_publishing_date?: string | null;
  content_type?: unknown;
  moodboard_status?: unknown;
  creative_production_status?: unknown;
  approval_status?: unknown;
  publishing_status?: unknown;
  published_url?: unknown;
  published_at?: unknown;
  assignee_id: string | null;
  assignee: TaskAssignee | null;
  designer_ids?: unknown;
  social_manager_ids?: unknown;
  company_id: string | null;
  social_media_plan_id: string | null;
  custom_fields?: Record<string, unknown>;
};

type SocialMediaPost = {
  task: Task;
  plan: SocialMediaPlan;
  managerIds: string[];
  designerIds: string[];
};

export type SocialMediaPlan = {
  id: string;
  month: string;
  monthly_post_target: number;
  weekly_posting_frequency: number | null;
  required_formats: unknown;
  social_manager_id: string | null;
  designer_id: string | null;
  moodboard_status: string;
  moodboard_task_id: string | null;
  company: Company;
  content_task_ids: string[];
  content_tasks: SocialMediaContentTask[];
  moodboard_task: MoodboardTask;
};

type CalendarFilters = {
  clientId: string;
  managerId: string;
  designerId: string;
  contentType: string;
  status: string;
  from: string;
  to: string;
  overdueOnly: boolean;
  withoutPlanOnly: boolean;
  belowTargetOnly: boolean;
};

const EMPTY_FILTERS: CalendarFilters = {
  clientId: "",
  managerId: "",
  designerId: "",
  contentType: "",
  status: "",
  from: "",
  to: "",
  overdueOnly: false,
  withoutPlanOnly: false,
  belowTargetOnly: false,
};

interface Props {
  projectId: string;
  workspaceId: string;
  tasks: Task[];
  customFields: CustomFieldDefinition[];
  users: TaskAssignee[];
  onOpenTask: (task: Task) => void;
  onRefresh: () => void | Promise<void>;
}

/**
 * A Social Media list is intentionally still made of normal UpFlow tasks. This
 * view adds the planning context around those tasks (clients, monthly targets,
 * moodboards and publishing stages) without making the task system fork.
 */
export default function SocialMediaCalendar({
  projectId,
  workspaceId,
  tasks,
  customFields,
  users,
  onOpenTask,
  onRefresh,
}: Props) {
  const [plans, setPlans] = useState<SocialMediaPlan[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [calendarFields, setCalendarFields] = useState<CustomFieldDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<CalendarFilters>(EMPTY_FILTERS);
  const [calendarMonth, setCalendarMonth] = useState(currentMonthKey());
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [addingPostFor, setAddingPostFor] = useState<string | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const [plansResult, companiesResult] = await Promise.all([
          fetch(`/api/projects/${projectId}/social-media`),
          fetch("/api/companies?limit=100"),
        ]);
        if (!plansResult.ok) throw new Error("Could not load the social media calendar");
        const planPayload = (await plansResult.json()) as {
          items?: SocialMediaPlan[];
          plans?: SocialMediaPlan[];
          custom_fields?: CustomFieldDefinition[];
        };
        const companyPayload = companiesResult.ok
          ? ((await companiesResult.json()) as { items?: Company[] })
          : { items: [] as Company[] };
        setPlans(planPayload.items ?? planPayload.plans ?? []);
        setCalendarFields(planPayload.custom_fields ?? []);
        setCompanies(companyPayload.items ?? []);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not load the social media calendar");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [projectId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const fieldsByName = useMemo(() => {
    const fieldsById = new Map(customFields.map((field) => [field.id, field]));
    calendarFields.forEach((field) => fieldsById.set(field.id, field));
    return new Map(
      Array.from(fieldsById.values()).map((field) => [field.name.trim().toLocaleLowerCase(), field]),
    );
  }, [calendarFields, customFields]);
  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const plansForMonth = useMemo(
    () => plans.filter((plan) => monthKey(plan.month) === calendarMonth),
    [calendarMonth, plans],
  );
  const posts = useMemo(
    () =>
      plans.flatMap((plan) =>
        plan.content_tasks.map((contentTask) => {
          const task = hydrateSocialMediaTask(
            contentTask,
            taskById.get(contentTask.id),
            fieldsByName,
            projectId,
          );
          return {
            task,
            plan,
            managerIds: roleIdsForPost(
              contentTask.social_manager_ids,
              task.assignee_id,
              plan.social_manager_id,
            ),
            designerIds: roleIdsForPost(contentTask.designer_ids, null, plan.designer_id),
          };
        }),
      ),
    [fieldsByName, plans, projectId, taskById],
  );

  const planStats = useMemo(() => {
    const stats = new Map<string, PlanStats>();
    for (const plan of plans) {
      const planPosts = posts.filter((post) => post.plan.id === plan.id).map((post) => post.task);
      const publishing = planPosts.map((task) => effectivePublishingStatus(task, fieldsByName));
      stats.set(plan.id, {
        planned: planPosts.length,
        inProduction: planPosts.filter(
          (task) => fieldValue(task, fieldsByName, FIELD_NAMES.contentStatus) === "In Production",
        ).length,
        awaitingApproval: planPosts.filter((task) => {
          const contentStatus = fieldValue(task, fieldsByName, FIELD_NAMES.contentStatus);
          const approvalStatus = fieldValue(task, fieldsByName, FIELD_NAMES.approvalStatus);
          return contentStatus === "Awaiting Approval" || approvalStatus === "Awaiting Approval";
        }).length,
        scheduled: publishing.filter((value) => value === "Scheduled").length,
        published: publishing.filter((value) => value === "Published").length,
        overdue: publishing.filter((value) => value === "Overdue").length,
        shortfall: Math.max(0, plan.monthly_post_target - planPosts.length),
      });
    }
    return stats;
  }, [fieldsByName, plans, posts]);

  const contentTypes = useMemo(
    () =>
      Array.from(
        new Set(
          posts
            .map(({ task }) => fieldValue(task, fieldsByName, FIELD_NAMES.contentType))
            .filter(Boolean),
        ),
      ).sort(),
    [fieldsByName, posts],
  );
  const statusOptions = useMemo(
    () => Array.from(new Set([...CONTENT_STATUSES, ...APPROVAL_STATUSES, ...PUBLISHING_STATUSES])),
    [],
  );

  const filteredPosts = useMemo(() => {
    if (filters.withoutPlanOnly) return [];
    return posts.filter(({ task, plan, managerIds, designerIds }) => {
      const date = taskDateKey(task);
      const contentType = fieldValue(task, fieldsByName, FIELD_NAMES.contentType);
      const contentStatus = fieldValue(task, fieldsByName, FIELD_NAMES.contentStatus);
      const approvalStatus = fieldValue(task, fieldsByName, FIELD_NAMES.approvalStatus);
      const publishingStatus = effectivePublishingStatus(task, fieldsByName);
      const stats = planStats.get(plan.id);
      if (filters.clientId && plan.company.id !== filters.clientId) return false;
      if (filters.managerId && !managerIds.includes(filters.managerId)) return false;
      if (filters.designerId && !designerIds.includes(filters.designerId)) return false;
      if (filters.contentType && contentType !== filters.contentType) return false;
      if (
        filters.status &&
        ![contentStatus, approvalStatus, publishingStatus, plan.moodboard_status].includes(filters.status)
      ) {
        return false;
      }
      if (filters.from && (!date || date < filters.from)) return false;
      if (filters.to && (!date || date > filters.to)) return false;
      if (filters.overdueOnly && publishingStatus !== "Overdue") return false;
      if (filters.belowTargetOnly && !(stats && stats.shortfall > 0)) return false;
      return true;
    });
  }, [fieldsByName, filters, planStats, posts]);

  const postsByDate = useMemo(() => {
    const map = new Map<string, Array<{ task: Task; plan: SocialMediaPlan }>>();
    filteredPosts.forEach((post) => {
      const date = taskDateKey(post.task);
      if (!date) return;
      const list = map.get(date) ?? [];
      list.push(post);
      map.set(date, list);
    });
    return map;
  }, [filteredPosts]);

  const plansWithoutContent = useMemo(() => {
    const plannedCompanyIds = new Set(plansForMonth.map((plan) => plan.company.id));
    return companies.filter((company) => !plannedCompanyIds.has(company.id));
  }, [companies, plansForMonth]);

  const alerts = useMemo(() => {
    const rows: CalendarAlert[] = [];
    if (plansWithoutContent.length) {
      rows.push({
        tone: "slate",
        title: `${plansWithoutContent.length} client${plansWithoutContent.length === 1 ? "" : "s"} without a content plan`,
        detail: plansWithoutContent.slice(0, 4).map((company) => company.name).join(", "),
      });
    }
    for (const plan of plansForMonth) {
      const stats = planStats.get(plan.id);
      if (stats?.shortfall) {
        rows.push({
          tone: "amber",
          title: `${plan.company.name}: ${stats.shortfall} additional creative item${stats.shortfall === 1 ? "" : "s"} required`,
          detail: `${stats.planned} of ${plan.monthly_post_target} contracted posts are planned.`,
        });
      }
      const frequencyTarget = (plan.weekly_posting_frequency ?? 0) * weeksInMonth(plan.month);
      if (frequencyTarget > 0 && stats && stats.planned < frequencyTarget) {
        rows.push({
          tone: "amber",
          title: `${plan.company.name}: posting frequency is below plan`,
          detail: `${stats.planned} items are planned; ${frequencyTarget} are needed to support ${plan.weekly_posting_frequency} posts per week.`,
        });
      }
      const postingGap = clientPostingGap(plan, posts);
      if (postingGap && monthKey(plan.month) >= currentMonthKey()) {
        rows.push({
          tone: "amber",
          title: `${plan.company.name}: ${postingGap.days}-day posting gap (7-day threshold)`,
          detail: `No content is planned from ${postingGap.start} through ${postingGap.end}.`,
        });
      }
      if (!isMoodboardReady(plan.moodboard_status) && monthIsCurrentOrPast(plan.month)) {
        rows.push({
          tone: "violet",
          title: `${plan.company.name}: moodboard is ${plan.moodboard_status.toLocaleLowerCase()}`,
          detail: "Creative production remains locked until the moodboard is ready.",
        });
      }
      if (monthKey(plan.month) === currentMonthKey()) {
        const nextWeek = addDaysKey(todayKey(), 7);
        const hasUpcomingPost = posts.some(({ task, plan: postPlan }) => {
          const date = taskDateKey(task);
          return postPlan.id === plan.id && Boolean(date) && date >= todayKey() && date <= nextWeek;
        });
        if (!hasUpcomingPost) {
          rows.push({
            tone: "slate",
            title: `${plan.company.name}: no post planned in the next 7 days`,
            detail: "Add or reschedule content to maintain a consistent publishing rhythm.",
          });
        }
      }
    }
    const overdue = posts.filter(({ task }) => effectivePublishingStatus(task, fieldsByName) === "Overdue");
    if (overdue.length) {
      rows.push({
        tone: "red",
        title: `${overdue.length} overdue post${overdue.length === 1 ? "" : "s"}`,
        detail: overdue.slice(0, 3).map(({ task }) => task.title).join(", "),
      });
    }
    const awaitingSchedule = posts.filter(({ task }) => {
      const approval = fieldValue(task, fieldsByName, FIELD_NAMES.approvalStatus);
      const publishing = effectivePublishingStatus(task, fieldsByName);
      return approval === "Approved" && !["Scheduled", "Published", "Cancelled"].includes(publishing);
    });
    if (awaitingSchedule.length) {
      rows.push({
        tone: "yellow",
        title: `${awaitingSchedule.length} approved post${awaitingSchedule.length === 1 ? "" : "s"} not yet scheduled`,
        detail: "Set a publishing date or move the item to Scheduled.",
      });
    }
    return rows;
  }, [fieldsByName, planStats, plansForMonth, plansWithoutContent, posts]);

  const updateTaskField = async (
    task: Task,
    fieldName: string,
    value: string,
    taskStatus?: Task["status"],
  ) => {
    const definition = fieldsByName.get(fieldName.toLocaleLowerCase());
    if (!definition) {
      toast.error(`${fieldName} is not configured for this list yet.`);
      return;
    }
    const key = `${task.id}:${definition.id}`;
    setSavingKey(key);
    try {
      const response = await fetch(`/api/tasks/${task.id}/custom-fields`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          definition_id: definition.id,
          value,
          ...(taskStatus ? { task_status: taskStatus } : {}),
        }),
      });
      if (!response.ok) throw new Error(await apiError(response, "Could not update the content stage"));
      await Promise.all([load(true), Promise.resolve(onRefresh())]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the content stage");
    } finally {
      setSavingKey(null);
    }
  };

  const updateMoodboard = async (plan: SocialMediaPlan, moodboardStatus: string) => {
    setSavingKey(`moodboard:${plan.id}`);
    try {
      const response = await fetch(`/api/social-media/plans/${plan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moodboard_status: moodboardStatus }),
      });
      if (!response.ok) throw new Error(await apiError(response, "Could not update the moodboard"));
      await Promise.all([load(true), Promise.resolve(onRefresh())]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the moodboard");
    } finally {
      setSavingKey(null);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([load(true), Promise.resolve(onRefresh())]);
  };

  const monthLabel = monthTitle(calendarMonth);
  const activeFilterCount = Object.values(filters).filter((value) => value !== "" && value !== false).length;
  const visiblePlanSummaries = plansForMonth.filter((plan) => {
    const stats = planStats.get(plan.id);
    const planPosts = posts.filter((post) => post.plan.id === plan.id);
    if (filters.clientId && filters.clientId !== plan.company.id) return false;
    if (filters.managerId && !planPosts.some((post) => post.managerIds.includes(filters.managerId))) return false;
    if (filters.designerId && !planPosts.some((post) => post.designerIds.includes(filters.designerId))) return false;
    if (filters.belowTargetOnly && !(stats && stats.shortfall > 0)) return false;
    return true;
  });

  if (loading) {
    return <CalendarLoading />;
  }

  return (
    <div className="space-y-5" data-social-media-calendar>
      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/15 text-violet-600 dark:text-violet-300">
                <CalendarDays className="h-4 w-4" />
              </span>
              <h3 className="text-lg font-bold text-foreground">Social Media Calendar</h3>
              <span className="rounded-full border border-violet-500/25 bg-violet-500/10 px-2 py-0.5 text-[11px] font-semibold text-violet-700 dark:text-violet-200">
                Operational view
              </span>
            </div>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Plan each client&apos;s content, move work through production and approval, and see publishing risks before they become missed posts.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setFiltersOpen((open) => !open)}
              className={cn(
                "rounded-xl border px-3 py-2 text-sm font-semibold transition",
                filtersOpen || activeFilterCount
                  ? "border-primary/35 bg-primary/10 text-primary"
                  : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              Filters{activeFilterCount ? ` (${activeFilterCount})` : ""}
              {filtersOpen ? <ChevronUp className="ml-1 inline h-3.5 w-3.5" /> : <ChevronDown className="ml-1 inline h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} /> Refresh
            </button>
            <button
              type="button"
              onClick={() => setShowPlanForm((show) => !show)}
              className="upflow-gradient-button inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold text-white"
            >
              <Plus className="h-4 w-4" /> New content plan
            </button>
          </div>
        </div>

        {filtersOpen && (
          <FilterPanel
            filters={filters}
            setFilters={setFilters}
            companies={companies}
            users={users}
            contentTypes={contentTypes}
            statusOptions={statusOptions}
          />
        )}

        {showPlanForm && (
          <NewPlanForm
            projectId={projectId}
            workspaceId={workspaceId}
            companies={companies}
            users={users}
            defaultMonth={calendarMonth}
            onClose={() => setShowPlanForm(false)}
            onCreated={async () => {
              setShowPlanForm(false);
              await Promise.all([load(true), Promise.resolve(onRefresh())]);
            }}
          />
        )}
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" aria-label="Client content plan overview">
        {visiblePlanSummaries.map((plan) => (
          <PlanSummary
            key={plan.id}
            plan={plan}
            stats={planStats.get(plan.id) ?? emptyPlanStats()}
            users={users}
            saving={savingKey === `moodboard:${plan.id}`}
            onMoodboardChange={(value) => void updateMoodboard(plan, value)}
            onOpenMoodboard={() => {
              const task = plan.moodboard_task
                ? taskById.get(plan.moodboard_task.id) ?? hydrateMoodboardTask(plan, projectId)
                : null;
              if (task) onOpenTask(task);
            }}
            onAddPost={() => setAddingPostFor((current) => (current === plan.id ? null : plan.id))}
          />
        ))}
        {visiblePlanSummaries.length === 0 && !filters.withoutPlanOnly && (
          <EmptyPlanSummary onCreate={() => setShowPlanForm(true)} />
        )}
      </section>

      {addingPostFor && (
        <AdditionalPostForm
          plan={plans.find((plan) => plan.id === addingPostFor) ?? null}
          users={users}
          defaultDate={`${calendarMonth}-01`}
          onClose={() => setAddingPostFor(null)}
          onCreated={async () => {
            setAddingPostFor(null);
            await Promise.all([load(true), Promise.resolve(onRefresh())]);
          }}
        />
      )}

      {filters.withoutPlanOnly ? (
        <MissingPlanPanel companies={plansWithoutContent} onCreate={() => setShowPlanForm(true)} />
      ) : (
        <section className="rounded-2xl border border-border bg-card shadow-sm">
          <CalendarHeader
            label={monthLabel}
            onPrevious={() => setCalendarMonth((month) => shiftMonth(month, -1))}
            onNext={() => setCalendarMonth((month) => shiftMonth(month, 1))}
            onToday={() => setCalendarMonth(currentMonthKey())}
          />
          <MonthGrid
            month={calendarMonth}
            postsByDate={postsByDate}
            fieldsByName={fieldsByName}
            savingKey={savingKey}
            onOpenTask={onOpenTask}
            onUpdateField={updateTaskField}
          />
          <UnscheduledRail
            posts={filteredPosts.filter(({ task }) => !taskDateKey(task))}
            onOpenTask={onOpenTask}
          />
        </section>
      )}

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5" aria-label="Social media operational alerts">
        <div className="mb-3 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-amber-500" />
          <h3 className="text-sm font-bold text-foreground">Operational alerts</h3>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">{alerts.length}</span>
        </div>
        {alerts.length ? (
          <div className="grid gap-2 lg:grid-cols-2">
            {alerts.map((alert, index) => (
              <AlertRow key={`${alert.title}-${index}`} alert={alert} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-3 text-sm text-emerald-700 dark:text-emerald-200">
            Everything is on track for the selected month. No social media bottlenecks are currently detected.
          </div>
        )}
      </section>
    </div>
  );
}

function NewPlanForm({
  projectId,
  workspaceId: _workspaceId,
  companies,
  users,
  defaultMonth,
  onClose,
  onCreated,
}: {
  projectId: string;
  workspaceId: string;
  companies: Company[];
  users: TaskAssignee[];
  defaultMonth: string;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [companyId, setCompanyId] = useState("");
  const [month, setMonth] = useState(defaultMonth);
  const [target, setTarget] = useState("12");
  const [frequency, setFrequency] = useState("3");
  const [formats, setFormats] = useState("Carousel, Reel, Static Post");
  const [managerId, setManagerId] = useState("");
  const [designerId, setDesignerId] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!companyId) {
      toast.error("Choose a client before creating the content plan.");
      return;
    }
    const monthlyTarget = Number(target);
    if (!Number.isInteger(monthlyTarget) || monthlyTarget < 1) {
      toast.error("The monthly contracted target must be at least 1 post.");
      return;
    }
    const weeklyFrequency = Number(frequency);
    if (!Number.isInteger(weeklyFrequency) || weeklyFrequency < 1 || weeklyFrequency > 7) {
      toast.error("Weekly posting frequency must be between 1 and 7 posts.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/social-media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: companyId,
          month: `${month}-01`,
          monthly_post_target: monthlyTarget,
          weekly_posting_frequency: weeklyFrequency,
          required_formats: formats.split(",").map((value) => value.trim()).filter(Boolean),
          social_manager_id: managerId || null,
          designer_id: designerId || null,
        }),
      });
      if (!response.ok) throw new Error(await apiError(response, "Could not create the content plan"));
      toast.success("Content plan created with its moodboard and scheduled post items.");
      await onCreated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create the content plan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-4 grid gap-3 rounded-xl border border-primary/20 bg-primary/[0.04] p-4 lg:grid-cols-3">
      <FormField label="Client">
        <select value={companyId} onChange={(event) => setCompanyId(event.target.value)} className={fieldControlClass} required>
          <option value="">Choose a client</option>
          {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
        </select>
      </FormField>
      <FormField label="Plan month">
        <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className={fieldControlClass} required />
      </FormField>
      <FormField label="Contracted posts">
        <input type="number" min="1" max="100" value={target} onChange={(event) => setTarget(event.target.value)} className={fieldControlClass} required />
      </FormField>
      <FormField label="Weekly posting frequency">
        <input type="number" min="1" max="7" value={frequency} onChange={(event) => setFrequency(event.target.value)} className={fieldControlClass} />
      </FormField>
      <FormField label="Required formats" hint="Comma-separated">
        <input value={formats} onChange={(event) => setFormats(event.target.value)} className={fieldControlClass} placeholder="Carousel, Reel, Static Post" />
      </FormField>
      <FormField label="Social Media Manager">
        <UserSelect value={managerId} users={users} onChange={setManagerId} placeholder="Assign later" />
      </FormField>
      <FormField label="Designer">
        <UserSelect value={designerId} users={users} onChange={setDesignerId} placeholder="Assign later" />
      </FormField>
      <div className="flex items-end gap-2 lg:col-span-2">
        <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">Cancel</button>
        <button type="submit" disabled={saving || !companies.length} className="upflow-gradient-button inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Create automated plan
        </button>
      </div>
    </form>
  );
}

function AdditionalPostForm({
  plan,
  users,
  defaultDate,
  onClose,
  onCreated,
}: {
  plan: SocialMediaPlan | null;
  users: TaskAssignee[];
  defaultDate: string;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [contentType, setContentType] = useState(firstFormat(plan?.required_formats));
  const [scheduledDate, setScheduledDate] = useState(defaultDate);
  const [assigneeId, setAssigneeId] = useState(plan?.social_manager_id ?? "");
  const [designerId, setDesignerId] = useState(plan?.designer_id ?? "");
  const [saving, setSaving] = useState(false);

  if (!plan) return null;
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/social-media/plans/${plan.id}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          content_type: contentType || "Static Post",
          scheduled_date: scheduledDate || null,
          assignee_id: assigneeId || null,
          designer_id: designerId || null,
        }),
      });
      if (!response.ok) throw new Error(await apiError(response, "Could not add the content item"));
      toast.success("Content item added to the calendar.");
      await onCreated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add the content item");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-2xl border border-primary/25 bg-primary/[0.04] p-4 md:grid-cols-2 xl:grid-cols-5">
      <div className="md:col-span-2 xl:col-span-2"><p className="text-sm font-bold text-foreground">Add content for {plan.company.name}</p><p className="mt-1 text-xs text-muted-foreground">Use this for the additional creatives identified by the plan target.</p></div>
      <FormField label="Content title"><input value={title} onChange={(event) => setTitle(event.target.value)} className={fieldControlClass} placeholder="July product reel" required /></FormField>
      <FormField label="Format"><input value={contentType} onChange={(event) => setContentType(event.target.value)} className={fieldControlClass} placeholder="Reel" /></FormField>
      <FormField label="Scheduled publishing date"><input type="date" value={scheduledDate} onChange={(event) => setScheduledDate(event.target.value)} className={fieldControlClass} /></FormField>
      <FormField label="Responsible"><UserSelect value={assigneeId} users={users} onChange={setAssigneeId} placeholder="Use plan manager" /></FormField>
      <FormField label="Designer"><UserSelect value={designerId} users={users} onChange={setDesignerId} placeholder="Use plan designer" /></FormField>
      <div className="flex items-end justify-end gap-2 md:col-span-2 xl:col-span-3">
        <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">Cancel</button>
        <button type="submit" disabled={saving} className="upflow-gradient-button inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving && <Loader2 className="h-4 w-4 animate-spin" />} Add item</button>
      </div>
    </form>
  );
}

function FilterPanel({
  filters,
  setFilters,
  companies,
  users,
  contentTypes,
  statusOptions,
}: {
  filters: CalendarFilters;
  setFilters: React.Dispatch<React.SetStateAction<CalendarFilters>>;
  companies: Company[];
  users: TaskAssignee[];
  contentTypes: string[];
  statusOptions: string[];
}) {
  const set = (key: keyof CalendarFilters, value: string | boolean) => setFilters((current) => ({ ...current, [key]: value }));
  return (
    <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-4">
      <FilterSelect label="Client" value={filters.clientId} onChange={(value) => set("clientId", value)} options={companies.map((company) => ({ value: company.id, label: company.name }))} />
      <FilterSelect label="Social Media Manager" value={filters.managerId} onChange={(value) => set("managerId", value)} options={users.map((user) => ({ value: user.id, label: user.name }))} />
      <FilterSelect label="Designer" value={filters.designerId} onChange={(value) => set("designerId", value)} options={users.map((user) => ({ value: user.id, label: user.name }))} />
      <FilterSelect label="Content type" value={filters.contentType} onChange={(value) => set("contentType", value)} options={contentTypes.map((value) => ({ value, label: value }))} />
      <FilterSelect label="Stage or status" value={filters.status} onChange={(value) => set("status", value)} options={statusOptions.map((value) => ({ value, label: value }))} />
      <FormField label="From"><input type="date" value={filters.from} onChange={(event) => set("from", event.target.value)} className={fieldControlClass} /></FormField>
      <FormField label="To"><input type="date" value={filters.to} onChange={(event) => set("to", event.target.value)} className={fieldControlClass} /></FormField>
      <div className="flex flex-wrap items-end gap-3 pb-1">
        <FilterToggle label="Overdue only" checked={filters.overdueOnly} onChange={(checked) => set("overdueOnly", checked)} />
        <FilterToggle label="Without a plan" checked={filters.withoutPlanOnly} onChange={(checked) => set("withoutPlanOnly", checked)} />
        <FilterToggle label="Below target" checked={filters.belowTargetOnly} onChange={(checked) => set("belowTargetOnly", checked)} />
        <button type="button" onClick={() => setFilters(EMPTY_FILTERS)} className="text-xs font-semibold text-primary hover:underline">Clear all</button>
      </div>
    </div>
  );
}

function PlanSummary({
  plan,
  stats,
  users,
  saving,
  onMoodboardChange,
  onOpenMoodboard,
  onAddPost,
}: {
  plan: SocialMediaPlan;
  stats: PlanStats;
  users: TaskAssignee[];
  saving: boolean;
  onMoodboardChange: (value: string) => void;
  onOpenMoodboard: () => void;
  onAddPost: () => void;
}) {
  const manager = users.find((user) => user.id === plan.social_manager_id);
  const designer = users.find((user) => user.id === plan.designer_id);
  return (
    <article className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-bold text-foreground">{plan.company.name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{stats.planned} planned of {plan.monthly_post_target} contracted posts</p>
        </div>
        {stats.shortfall > 0 ? <StatusPill tone="amber">+{stats.shortfall} needed</StatusPill> : <StatusPill tone="green">On target</StatusPill>}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Metric label="Production" value={stats.inProduction} tone="violet" />
        <Metric label="Approval" value={stats.awaitingApproval} tone="yellow" />
        <Metric label="Scheduled" value={stats.scheduled} tone="blue" />
        <Metric label="Published" value={stats.published} tone="green" />
        <Metric label="Overdue" value={stats.overdue} tone="red" />
        <Metric label="Weekly" value={plan.weekly_posting_frequency ?? 0} tone="slate" />
      </div>
      <div className="mt-3 grid gap-2 border-t border-border pt-3 text-xs">
        <label className="grid grid-cols-[auto_1fr] items-center gap-2 text-muted-foreground">
          <span className={cn("inline-flex h-5 w-5 items-center justify-center rounded-full", isMoodboardReady(plan.moodboard_status) ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground")}>
            {isMoodboardReady(plan.moodboard_status) ? <Check className="h-3 w-3" /> : "M"}
          </span>
          <span className="min-w-0"><span className="font-semibold text-foreground">Moodboard</span>{" "}
            <select value={plan.moodboard_status} onChange={(event) => onMoodboardChange(event.target.value)} disabled={saving} className="ml-1 max-w-[150px] rounded border border-transparent bg-transparent px-1 py-0.5 text-xs text-foreground hover:border-border focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50">
              {MOODBOARD_STATUSES.map((status) => <option key={status}>{status}</option>)}
            </select>
          </span>
        </label>
        <div className="flex items-center justify-between gap-2 text-muted-foreground"><span>Manager: <strong className="font-medium text-foreground">{manager?.name ?? "Unassigned"}</strong></span><span>Designer: <strong className="font-medium text-foreground">{designer?.name ?? "Unassigned"}</strong></span></div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        {plan.moodboard_task && <button type="button" onClick={onOpenMoodboard} className="text-xs font-semibold text-primary hover:underline">Open moodboard task</button>}
        <button type="button" onClick={onAddPost} className="ml-auto inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground"><Plus className="h-3 w-3" /> Add post</button>
      </div>
    </article>
  );
}

function MonthGrid({
  month,
  postsByDate,
  fieldsByName,
  savingKey,
  onOpenTask,
  onUpdateField,
}: {
  month: string;
  postsByDate: Map<string, Array<{ task: Task; plan: SocialMediaPlan }>>;
  fieldsByName: Map<string, CustomFieldDefinition>;
  savingKey: string | null;
  onOpenTask: (task: Task) => void;
  onUpdateField: (task: Task, fieldName: string, value: string, taskStatus?: Task["status"]) => Promise<void>;
}) {
  const days = monthDays(month);
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[860px]">
        <div className="grid grid-cols-7 border-b border-border bg-muted/30">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <div key={day} className="px-2 py-2 text-center text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{day}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {days.map((date) => <DayCell key={date.key} date={date} posts={postsByDate.get(date.key) ?? []} fieldsByName={fieldsByName} savingKey={savingKey} onOpenTask={onOpenTask} onUpdateField={onUpdateField} />)}
        </div>
      </div>
    </div>
  );
}

function DayCell({
  date,
  posts,
  fieldsByName,
  savingKey,
  onOpenTask,
  onUpdateField,
}: {
  date: CalendarDate;
  posts: Array<{ task: Task; plan: SocialMediaPlan }>;
  fieldsByName: Map<string, CustomFieldDefinition>;
  savingKey: string | null;
  onOpenTask: (task: Task) => void;
  onUpdateField: (task: Task, fieldName: string, value: string, taskStatus?: Task["status"]) => Promise<void>;
}) {
  if (!date.inMonth) return <div className="min-h-[140px] border-b border-r border-border/70 bg-muted/[0.16] p-2" aria-hidden="true" />;
  const today = date.key === todayKey();
  return (
    <div className={cn("min-h-[160px] border-b border-r border-border/70 p-2", today && "bg-primary/[0.035]")}>
      <div className="mb-1 flex items-center justify-between"><span className={cn("inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold", today ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>{date.day}</span>{posts.length > 0 && <span className="text-[10px] font-semibold text-muted-foreground">{posts.length}</span>}</div>
      <div className="space-y-1.5">
        {posts.map(({ task, plan }) => (
          <PostCard key={task.id} task={task} plan={plan} fieldsByName={fieldsByName} savingKey={savingKey} onOpenTask={onOpenTask} onUpdateField={onUpdateField} />
        ))}
      </div>
    </div>
  );
}

function PostCard({
  task,
  plan,
  fieldsByName,
  savingKey,
  onOpenTask,
  onUpdateField,
}: {
  task: Task;
  plan: SocialMediaPlan;
  fieldsByName: Map<string, CustomFieldDefinition>;
  savingKey: string | null;
  onOpenTask: (task: Task) => void;
  onUpdateField: (task: Task, fieldName: string, value: string, taskStatus?: Task["status"]) => Promise<void>;
}) {
  const contentType = fieldValue(task, fieldsByName, FIELD_NAMES.contentType) || "Post";
  const contentStatus = fieldValue(task, fieldsByName, FIELD_NAMES.contentStatus) || "Not Requested";
  const approvalStatus = fieldValue(task, fieldsByName, FIELD_NAMES.approvalStatus) || "Not Requested";
  const publishingStatus = effectivePublishingStatus(task, fieldsByName);
  const publishedUrl = fieldValue(task, fieldsByName, FIELD_NAMES.publishedUrl);
  const publishedAt = fieldValue(task, fieldsByName, FIELD_NAMES.publishedAt);
  const moodboardReady = isMoodboardReady(plan.moodboard_status);
  const canPublish = approvalStatus === "Approved" && ["Approved", "Scheduled"].includes(contentStatus);
  const contentField = fieldsByName.get(FIELD_NAMES.contentStatus.toLocaleLowerCase());
  const approvalField = fieldsByName.get(FIELD_NAMES.approvalStatus.toLocaleLowerCase());
  const publishingField = fieldsByName.get(FIELD_NAMES.publishingStatus.toLocaleLowerCase());

  return (
    <article className={cn("rounded-lg border p-2 text-left shadow-sm", cardTone(publishingStatus, contentStatus))}>
      <button type="button" onClick={() => onOpenTask(task)} className="block w-full text-left">
        <span className="block truncate text-[11px] font-bold text-foreground">{plan.company.name}</span>
        <span className="block truncate text-[10px] text-muted-foreground">{task.title}</span>
      </button>
      <div className="mt-1 flex flex-wrap items-center gap-1">
        <span className="rounded bg-background/70 px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">{contentType}</span>
        <span className={cn("inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-semibold", moodboardReady ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-200" : "bg-muted text-muted-foreground")}><Check className={cn("h-2.5 w-2.5", !moodboardReady && "hidden")} />Moodboard: {plan.moodboard_status}</span>
      </div>
      <p className="mt-1 truncate text-[9px] text-muted-foreground">Responsible: {task.assignee?.name ?? "Unassigned"}</p>
      <div className="mt-1.5 grid gap-1">
        <StageSelect label="Production" value={contentStatus} options={CONTENT_STATUSES} disabled={!moodboardReady || savingKey === `${task.id}:${contentField?.id}`} onChange={(value) => void onUpdateField(task, FIELD_NAMES.contentStatus, value, value === "Not Requested" ? "todo" : "in_progress")} />
        <StageSelect label="Approval" value={approvalStatus} options={APPROVAL_STATUSES} disabled={!moodboardReady || savingKey === `${task.id}:${approvalField?.id}`} onChange={(value) => void onUpdateField(task, FIELD_NAMES.approvalStatus, value)} />
        <StageSelect label="Publishing" value={publishingStatus} options={PUBLISHING_STATUSES} disabled={!canPublish || savingKey === `${task.id}:${publishingField?.id}`} onChange={(value) => void onUpdateField(task, FIELD_NAMES.publishingStatus, value, value === "Published" ? "done" : undefined)} />
      </div>
      {publishingStatus === "Published" && <span className="mt-1 inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-700 dark:text-emerald-200"><Check className="h-3 w-3" /> Published{publishedAt ? ` ${publishedAt.slice(0, 16).replace("T", " ")}` : ""}</span>}
      {publishedUrl && <a href={publishedUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} className="mt-1 inline-flex max-w-full items-center gap-0.5 truncate text-[9px] font-semibold text-primary hover:underline"><ExternalLink className="h-2.5 w-2.5" /> Published post</a>}
      {!moodboardReady && <p className="mt-1 text-[9px] font-medium text-violet-700 dark:text-violet-200">Production unlocks when the moodboard is ready.</p>}
    </article>
  );
}

function StageSelect({ label, value, options, disabled, onChange }: { label: string; value: string; options: string[]; disabled: boolean; onChange: (value: string) => void }) {
  return <label className="flex items-center justify-between gap-1 text-[9px] text-muted-foreground"><span>{label}</span><select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} onClick={(event) => event.stopPropagation()} className="max-w-[112px] truncate rounded border border-border/70 bg-background/80 px-1 py-0.5 text-[9px] text-foreground disabled:cursor-not-allowed disabled:opacity-55">{options.map((option) => <option key={option}>{option}</option>)}</select></label>;
}

function CalendarHeader({ label, onPrevious, onNext, onToday }: { label: string; onPrevious: () => void; onNext: () => void; onToday: () => void }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5"><div className="flex items-center gap-1"><button type="button" onClick={onPrevious} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Previous month"><ArrowLeft className="h-4 w-4" /></button><button type="button" onClick={onNext} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Next month"><ArrowRight className="h-4 w-4" /></button><button type="button" onClick={onToday} className="ml-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground">Today</button></div><h3 className="text-base font-bold text-foreground">{label}</h3><p className="text-xs text-muted-foreground">Green published · blue scheduled · yellow approval · purple production · red overdue</p></div>;
}

function UnscheduledRail({ posts, onOpenTask }: { posts: Array<{ task: Task; plan: SocialMediaPlan }>; onOpenTask: (task: Task) => void }) {
  if (!posts.length) return null;
  return <div className="border-t border-border p-4"><p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Unscheduled content</p><div className="flex flex-wrap gap-2">{posts.map(({ task, plan }) => <button key={task.id} type="button" onClick={() => onOpenTask(task)} className="rounded-lg border border-border bg-muted/30 px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-accent">{plan.company.name}: {task.title}</button>)}</div></div>;
}

function MissingPlanPanel({ companies, onCreate }: { companies: Company[]; onCreate: () => void }) {
  return <section className="rounded-2xl border border-border bg-card p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-base font-bold text-foreground">Clients without a content plan</h3><p className="mt-1 text-sm text-muted-foreground">These clients have no social-media plan for the displayed month.</p></div><button type="button" onClick={onCreate} className="upflow-gradient-button inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> Create plan</button></div>{companies.length ? <div className="mt-4 flex flex-wrap gap-2">{companies.map((company) => <span key={company.id} className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm font-semibold text-foreground">{company.name}</span>)}</div> : <p className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-3 text-sm text-emerald-700 dark:text-emerald-200">Every client has a plan for this month.</p>}</section>;
}

function AlertRow({ alert }: { alert: CalendarAlert }) {
  const toneClass: Record<CalendarAlert["tone"], string> = { slate: "border-border bg-muted/30", amber: "border-amber-500/25 bg-amber-500/[0.07]", violet: "border-violet-500/25 bg-violet-500/[0.07]", red: "border-red-500/25 bg-red-500/[0.07]", yellow: "border-yellow-500/25 bg-yellow-500/[0.07]" };
  return <div className={cn("rounded-xl border px-3 py-2.5", toneClass[alert.tone])}><p className="text-sm font-semibold text-foreground">{alert.title}</p>{alert.detail && <p className="mt-0.5 text-xs text-muted-foreground">{alert.detail}</p>}</div>;
}

function EmptyPlanSummary({ onCreate }: { onCreate: () => void }) {
  return <button type="button" onClick={onCreate} className="flex min-h-[176px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-4 text-center transition hover:border-primary/40 hover:bg-primary/[0.03]"><Plus className="h-5 w-5 text-primary" /><span className="mt-2 text-sm font-bold text-foreground">Create this month&apos;s first plan</span><span className="mt-1 text-xs text-muted-foreground">Automatically create the moodboard and scheduled content items.</span></button>;
}

function CalendarLoading() { return <div className="space-y-4"><div className="h-32 animate-pulse rounded-2xl bg-muted" /><div className="grid gap-3 md:grid-cols-3"><div className="h-44 animate-pulse rounded-2xl bg-muted" /><div className="h-44 animate-pulse rounded-2xl bg-muted" /><div className="h-44 animate-pulse rounded-2xl bg-muted" /></div><div className="h-[540px] animate-pulse rounded-2xl bg-muted" /></div>; }

function Metric({ label, value, tone }: { label: string; value: number; tone: "violet" | "yellow" | "blue" | "green" | "red" | "slate" }) { const colors = { violet: "text-violet-600 dark:text-violet-200", yellow: "text-yellow-700 dark:text-yellow-200", blue: "text-blue-600 dark:text-blue-200", green: "text-emerald-600 dark:text-emerald-200", red: "text-red-600 dark:text-red-200", slate: "text-muted-foreground" }; return <div className="rounded-lg bg-muted/45 px-1.5 py-1.5"><p className={cn("text-sm font-bold", colors[tone])}>{value}</p><p className="truncate text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p></div>; }
function StatusPill({ tone, children }: { tone: "amber" | "green"; children: React.ReactNode }) { return <span className={cn("shrink-0 rounded-full px-2 py-1 text-[10px] font-bold", tone === "amber" ? "bg-amber-500/15 text-amber-700 dark:text-amber-200" : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-200")}>{children}</span>; }
function FormField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) { return <label className="grid gap-1 text-xs font-semibold text-muted-foreground"><span>{label}{hint && <span className="ml-1 font-normal">({hint})</span>}</span>{children}</label>; }
function UserSelect({ value, users, onChange, placeholder }: { value: string; users: TaskAssignee[]; onChange: (value: string) => void; placeholder: string }) { return <select value={value} onChange={(event) => onChange(event.target.value)} className={fieldControlClass}><option value="">{placeholder}</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select>; }
function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) { return <FormField label={label}><select value={value} onChange={(event) => onChange(event.target.value)} className={fieldControlClass}><option value="">All</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></FormField>; }
function FilterToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) { return <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-3.5 w-3.5 rounded border-border text-primary focus:ring-primary" />{label}</label>; }

const fieldControlClass = "w-full rounded-lg border border-input bg-background px-2.5 py-2 text-sm text-foreground shadow-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20";

type PlanStats = { planned: number; inProduction: number; awaitingApproval: number; scheduled: number; published: number; overdue: number; shortfall: number };
type CalendarAlert = { tone: "slate" | "amber" | "violet" | "red" | "yellow"; title: string; detail?: string };
type CalendarDate = { key: string; day: number; inMonth: boolean };
type PostingGap = { days: number; start: string; end: string };

function emptyPlanStats(): PlanStats { return { planned: 0, inProduction: 0, awaitingApproval: 0, scheduled: 0, published: 0, overdue: 0, shortfall: 0 }; }
function hydrateSocialMediaTask(
  contentTask: SocialMediaContentTask,
  fallbackTask: Task | undefined,
  fieldsByName: Map<string, CustomFieldDefinition>,
  projectId: string,
): Task {
  const valuesByDefinitionId = new Map(
    fallbackTask?.custom_field_values?.map((value) => [value.definition_id, value]) ?? [],
  );
  Object.entries(serializedContentFields(contentTask)).forEach(([name, value]) => {
    const definition = fieldsByName.get(name.trim().toLocaleLowerCase());
    if (definition) valuesByDefinitionId.set(definition.id, { definition_id: definition.id, value });
  });

  return {
    ...(fallbackTask ?? {
      id: contentTask.id,
      title: contentTask.title,
      description: null,
      status: contentTask.status,
      priority: contentTask.priority,
      project_id: projectId,
      assignee_id: contentTask.assignee_id,
      parent_id: null,
      company_id: contentTask.company_id,
      social_media_plan_id: contentTask.social_media_plan_id,
      due_date: contentTask.due_date ?? contentTask.scheduled_publishing_date ?? null,
      position: 0,
      created_at: "",
      assignee: contentTask.assignee,
      project: null,
    }),
    id: contentTask.id,
    title: contentTask.title,
    status: contentTask.status,
    priority: contentTask.priority,
    assignee_id: contentTask.assignee_id,
    assignee: contentTask.assignee,
    company_id: contentTask.company_id,
    social_media_plan_id: contentTask.social_media_plan_id,
    due_date: contentTask.due_date ?? contentTask.scheduled_publishing_date ?? null,
    custom_field_values: Array.from(valuesByDefinitionId.values()),
  };
}
function hydrateMoodboardTask(plan: SocialMediaPlan, projectId: string): Task | null {
  if (!plan.moodboard_task) return null;
  return {
    id: plan.moodboard_task.id,
    title: plan.moodboard_task.title,
    description: null,
    status: plan.moodboard_task.status,
    priority: "medium",
    project_id: projectId,
    assignee_id: null,
    parent_id: null,
    company_id: plan.company.id,
    due_date: plan.moodboard_task.due_date ?? null,
    position: 0,
    created_at: "",
    assignee: null,
    project: null,
  };
}
function serializedContentFields(contentTask: SocialMediaContentTask): Record<string, unknown> {
  const fields = { ...(contentTask.custom_fields ?? {}) };
  const add = (name: string, value: unknown) => {
    if (value !== undefined && value !== null) fields[name] = value;
  };
  add(FIELD_NAMES.contentType, contentTask.content_type);
  add(FIELD_NAMES.contentStatus, contentTask.creative_production_status);
  add(FIELD_NAMES.approvalStatus, contentTask.approval_status);
  add(FIELD_NAMES.publishingStatus, contentTask.publishing_status);
  add(FIELD_NAMES.socialManager, contentTask.social_manager_ids);
  add(FIELD_NAMES.designer, contentTask.designer_ids);
  add(FIELD_NAMES.publishedUrl, contentTask.published_url);
  add(FIELD_NAMES.publishedAt, contentTask.published_at);
  return fields;
}
function roleIdsForPost(serializedValue: unknown, assigneeId: string | null, planRoleId: string | null): string[] {
  const explicitIds = peopleIds(serializedValue);
  if (explicitIds.length) return explicitIds;
  if (assigneeId) return [assigneeId];
  return planRoleId ? [planRoleId] : [];
}
function peopleIds(value: unknown): string[] {
  if (Array.isArray(value)) return Array.from(new Set(value.filter((item): item is string => typeof item === "string")));
  return typeof value === "string" && value ? [value] : [];
}
function fieldValue(task: Task, fieldsByName: Map<string, CustomFieldDefinition>, fieldName: string): string { const field = fieldsByName.get(fieldName.toLocaleLowerCase()); const raw = field ? task.custom_field_values?.find((value) => value.definition_id === field.id)?.value : null; if (Array.isArray(raw)) return raw.filter((value): value is string => typeof value === "string").join(", "); return typeof raw === "string" || typeof raw === "number" ? String(raw) : ""; }
function effectivePublishingStatus(task: Task, fieldsByName: Map<string, CustomFieldDefinition>) { const stored = fieldValue(task, fieldsByName, FIELD_NAMES.publishingStatus) || "Not Scheduled"; if (!["Published", "Cancelled"].includes(stored) && taskDateKey(task) && taskDateKey(task)! < todayKey()) return "Overdue"; return stored; }
function isMoodboardReady(status: string) { return status === "Ready" || status === "Approved"; }
function taskDateKey(task: Task) { return task.due_date ? task.due_date.slice(0, 10) : ""; }
function todayKey(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}
function currentMonthKey() { return todayKey().slice(0, 7); }
function monthKey(value: string) { return value.slice(0, 7); }
function dateKey(date: Date) { const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, "0"); const day = String(date.getDate()).padStart(2, "0"); return `${year}-${month}-${day}`; }
function addDaysKey(date: string, days: number) { const parsed = new Date(`${date}T12:00:00`); parsed.setDate(parsed.getDate() + days); return dateKey(parsed); }
function monthTitle(month: string) { const [year, monthIndex] = month.split("-").map(Number); return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(new Date(year, monthIndex - 1, 1)); }
function shiftMonth(month: string, amount: number) { const [year, monthIndex] = month.split("-").map(Number); return dateKey(new Date(year, monthIndex - 1 + amount, 1)).slice(0, 7); }
function monthDays(month: string): CalendarDate[] { const [year, monthIndex] = month.split("-").map(Number); const first = new Date(year, monthIndex - 1, 1); const last = new Date(year, monthIndex, 0); const result: CalendarDate[] = []; for (let i = 0; i < first.getDay(); i += 1) result.push({ key: `before-${i}`, day: 0, inMonth: false }); for (let day = 1; day <= last.getDate(); day += 1) { const date = new Date(year, monthIndex - 1, day); result.push({ key: dateKey(date), day, inMonth: true }); } while (result.length % 7) result.push({ key: `after-${result.length}`, day: 0, inMonth: false }); return result; }
function monthIsCurrentOrPast(month: string) { return monthKey(month) <= currentMonthKey(); }
function weeksInMonth(month: string) { const [year, monthIndex] = month.split("-").map(Number); const days = new Date(year, monthIndex, 0).getDate(); return Math.ceil(days / 7); }
function clientPostingGap(plan: SocialMediaPlan, posts: SocialMediaPost[]): PostingGap | null {
  const [year, month] = monthKey(plan.month).split("-").map(Number);
  if (!year || !month) return null;
  const postedDays = new Set(
    posts
      .filter((post) => post.plan.id === plan.id)
      .map((post) => taskDateKey(post.task))
      .filter((date) => date.startsWith(`${monthKey(plan.month)}-`)),
  );
  const lastDay = new Date(year, month, 0).getDate();
  let gapStart = "";
  let longestGap: PostingGap | null = null;
  for (let day = 1; day <= lastDay; day += 1) {
    const date = `${monthKey(plan.month)}-${String(day).padStart(2, "0")}`;
    if (!postedDays.has(date)) {
      if (!gapStart) gapStart = date;
      continue;
    }
    if (gapStart) {
      const days = daysBetweenKeys(gapStart, date);
      if (!longestGap || days > longestGap.days) longestGap = { days, start: gapStart, end: addDaysKey(date, -1) };
      gapStart = "";
    }
  }
  if (gapStart) {
    const end = `${monthKey(plan.month)}-${String(lastDay).padStart(2, "0")}`;
    const days = daysBetweenKeys(gapStart, addDaysKey(end, 1));
    if (!longestGap || days > longestGap.days) longestGap = { days, start: gapStart, end };
  }
  return longestGap && longestGap.days >= 7 ? longestGap : null;
}
function daysBetweenKeys(start: string, end: string) { return Math.round((new Date(`${end}T12:00:00`).getTime() - new Date(`${start}T12:00:00`).getTime()) / 86_400_000); }
function firstFormat(value: unknown) { return Array.isArray(value) && typeof value[0] === "string" ? value[0] : ""; }
function cardTone(publishingStatus: string, contentStatus: string) { if (publishingStatus === "Overdue") return "border-red-500/35 bg-red-500/[0.06]"; if (publishingStatus === "Published") return "border-emerald-500/35 bg-emerald-500/[0.06]"; if (publishingStatus === "Scheduled") return "border-blue-500/35 bg-blue-500/[0.06]"; if (contentStatus === "Awaiting Approval") return "border-yellow-500/35 bg-yellow-500/[0.06]"; if (contentStatus === "In Production") return "border-violet-500/35 bg-violet-500/[0.06]"; return "border-border bg-background"; }
async function apiError(response: Response, fallback: string) { try { const body = (await response.json()) as { error?: string }; return body.error || fallback; } catch { return fallback; } }
