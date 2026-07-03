export interface AppUser {
  id: string;
  name: string | null;
  email: string | null;
  image?: string | null;
  role: "admin" | "member";
  currentWorkspaceId?: string;
  currentRole?: "owner" | "admin" | "member" | "guest" | null;
  isSuperAdmin?: boolean;
}

export interface ProjectOwner {
  id: string;
  name: string;
  email: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: "active" | "archived";
  workspace_id: string;
  owner_id: string;
  space_id?: string | null;
  folder_id?: string | null;
  company_id?: string | null;
  onboarding_enabled?: boolean;
  closing_date?: string | null;
  onboarding_start_date?: string | null;
  responsible_salesperson_id?: string | null;
  initial_notes?: string | null;
  due_date: string | null;
  created_at: string;
  owner: ProjectOwner;
  space?: { id: string; name: string; icon: string | null } | null;
  folder?: { id: string; name: string; icon: string | null } | null;
  company?: {
    id: string;
    name: string;
    contract_value: number | null;
    commission: number | null;
    plan_name: string | null;
    service_type: string | null;
  } | null;
  _count: { tasks: number };
}

export interface Space {
  id: string;
  name: string;
  icon: string | null;
  workspace_id: string;
  owner_id: string;
  position: number;
  created_at: string;
  workspace?: { id: string; name: string } | null;
  _count?: { projects: number };
}

export interface Folder {
  id: string;
  name: string;
  icon: string | null;
  space_id: string;
  owner_id: string;
  parent_id?: string | null;
  position: number;
  created_at: string;
  _count?: { projects: number };
  children?: Folder[];
}

export interface TaskAssignee {
  id: string;
  name: string;
  email: string;
}

export interface TaskProject {
  id: string;
  name: string;
  workspace_id?: string;
}

export interface Subtask {
  id: string;
  title: string;
  status: "todo" | "in_progress" | "done";
  priority: "low" | "medium" | "high";
  assignee: TaskAssignee | null;
  created_at: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "done";
  priority: "low" | "medium" | "high";
  project_id: string;
  assignee_id: string | null;
  parent_id: string | null;
  company_id?: string | null;
  cover_image_url?: string | null;
  due_date: string | null;
  position: number;
  created_at: string;
  assignee: TaskAssignee | null;
  project: TaskProject | null;
  subtasks?: Subtask[];
  onboarding_link?: TaskOnboardingLink | null;
  marketing_b2b_onboarding_form?: MarketingB2BOnboardingFormSummary | null;
  marketing_b2c_onboarding_form?: MarketingB2COnboardingFormSummary | null;
  custom_field_values?: TaskCustomFieldValue[];
  _count?: { comments: number; subtasks: number };
}

export interface MarketingB2BOnboardingFormSummary {
  id: string;
  status: string;
  completed_at: string | null;
  updated_at?: string | null;
  values?: Record<string, string> | null;
  task_id?: string;
  checklist_item_id?: string;
  task?: {
    id: string;
    title: string;
    description?: string | null;
    status: string;
    project_id?: string | null;
    assignee?: { id: string; name: string; email: string } | null;
  } | null;
}

export interface MarketingB2COnboardingFormSummary {
  id: string;
  status: string;
  completed_at: string | null;
  updated_at?: string | null;
  values?: Record<string, string> | null;
  task_id?: string;
  checklist_item_id?: string;
  task?: {
    id: string;
    title: string;
    description?: string | null;
    status: string;
    project_id?: string | null;
    assignee?: { id: string; name: string; email: string } | null;
  } | null;
}

export interface TaskOnboardingLink {
  id: string;
  onboarding_id: string;
  company_id: string;
  company_name: string;
  department: string;
  title: string;
  status: string;
  progress: number;
  href: string;
}

export type CustomFieldType =
  | "text"
  | "number"
  | "dropdown"
  | "date"
  | "checkbox"
  | "people";

export interface CustomFieldDefinition {
  id: string;
  project_id: string;
  name: string;
  type: CustomFieldType;
  options: string[] | null;
  position: number;
  created_at: string;
}

export interface TaskCustomFieldValue {
  definition_id: string;
  value: unknown;
}

export interface CommentAuthor {
  id: string;
  name: string;
  email?: string;
}

export interface Comment {
  id: string;
  body: string;
  task_id: string;
  author_id: string;
  parent_id: string | null;
  created_at: string;
  author: CommentAuthor;
  replies?: Comment[];
}

export interface Doc {
  id: string;
  title: string;
  content: unknown;
  project_id: string;
  author_id: string;
  updated_at: string;
  project: { id: string; name: string } | null;
  author: { id: string; name: string };
}

export interface NotificationTask {
  id: string;
  title: string;
  project: { id: string; name: string } | null;
}

export interface NotificationWorkspace {
  id: string;
  name: string;
  slug: string;
}

export interface MemberJoinedData {
  new_member_id?: string;
  new_member_email?: string;
  new_member_name?: string;
  role?: "admin" | "member" | "guest";
}

export interface StatusChangedData {
  old_status?: "todo" | "in_progress" | "done";
  new_status?: "todo" | "in_progress" | "done";
  task_title?: string;
  actor_id?: string;
  actor_name?: string;
}

export interface MentionedData {
  comment_id?: string;
  comment_excerpt?: string;
  actor_id?: string;
  actor_name?: string;
  task_title?: string;
}

export interface DueSoonData {
  due_date?: string;
  task_title?: string;
}

export type NotificationKind =
  | "assigned"
  | "commented"
  | "due_soon"
  | "member_joined"
  | "status_changed"
  | "mentioned";

export interface Notification {
  id: string;
  type: NotificationKind;
  read: boolean;
  created_at: string;
  task: NotificationTask | null;
  workspace: NotificationWorkspace | null;
  /** Type-specific payload. */
  data:
    | MemberJoinedData
    | StatusChangedData
    | MentionedData
    | DueSoonData
    | Record<string, unknown>
    | null;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: "admin" | "member" | "guest";
  avatar_url: string | null;
  created_at: string;
  workspace_role?: "owner" | "admin" | "member" | "guest" | null;
  workspace_status?: "active" | "inactive" | null;
  department_id?: string | null;
  _count: { tasks: number; projects: number };
}

export interface Department {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  created_at: string;
  _count: { members: number };
}

export interface CalendarEventAttendee {
  id: string;
  user_id: string;
  status: string;
  user?: { id: string; name: string; email: string };
}

export interface CalendarEvent {
  id: string;
  workspace_id: string;
  title: string;
  description: string | null;
  type: "meeting" | "task" | "reminder" | "deadline";
  starts_at: string;
  ends_at: string | null;
  timezone: string;
  created_by: string;
  project_id: string | null;
  task_id: string | null;
  company_id?: string | null;
  location: string | null;
  meeting_url: string | null;
  color: string | null;
  created_at: string;
  updated_at: string;
  project?: { id: string; name: string } | null;
  task?: { id: string; title: string } | null;
  attendees?: CalendarEventAttendee[];
}

export interface TimeEntry {
  id: string;
  workspace_id: string;
  user_id: string;
  project_id: string | null;
  task_id: string | null;
  company_id?: string | null;
  description: string | null;
  started_at: string;
  stopped_at: string | null;
  duration_seconds: number;
  status: "running" | "stopped";
  created_at: string;
  updated_at: string;
  project?: { id: string; name: string } | null;
  task?: { id: string; title: string } | null;
}

export interface ActivityEvent {
  id: string;
  workspace_id: string;
  actor_id: string | null;
  type: string;
  entity_type: string;
  entity_id: string | null;
  project_id: string | null;
  task_id: string | null;
  company_id?: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  actor?: { id: string; name: string; email: string; avatar_url?: string | null } | null;
  company?: { id: string; name: string } | null;
}

export interface CompanyContact {
  id: string;
  workspace_id: string;
  company_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompanyNote {
  id: string;
  workspace_id: string;
  company_id: string;
  author_id: string;
  body: string;
  created_at: string;
  author?: { id: string; name: string; email: string } | null;
}

export interface Company {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  website: string | null;
  status: string;
  commercial_status: string | null;
  contract_value: number | null;
  commission: number | null;
  industry: string | null;
  service_type: string | null;
  plan_name: string | null;
  billing_cycle: string | null;
  included_services: string[] | null;
  plan_notes: string | null;
  notes: string | null;
  legal_name: string | null;
  cnpj: string | null;
  billing_email: string | null;
  main_contact_email: string | null;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  billing_notes: string | null;
  payment_terms: string | null;
  contract_start_date: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
  owner?: { id: string; name: string; email: string } | null;
  summary?: {
    project_count: number;
    active_project_count?: number;
    open_task_count: number;
    overdue_task_count: number;
    meeting_count: number;
    contact_count: number;
    tracked_seconds: number;
    risk_reasons: string[];
    health_status?: "healthy" | "attention" | "risk" | "not_enough_data";
    profitability_ratio: number | null;
    contract_value_per_tracked_hour: number | null;
    commission_per_tracked_hour: number | null;
    next_deadline: string | null;
    latest_activity?: {
      type: string;
      created_at: string;
      actor?: { id: string; name: string; email: string } | null;
    } | null;
    assigned_members?: Array<{ id: string; name: string; email: string }>;
  };
  contacts?: CompanyContact[];
  notes_log?: CompanyNote[];
  projects?: Pick<Project, "id" | "name" | "status" | "due_date">[];
  tasks?: Pick<Task, "id" | "title" | "status" | "priority" | "due_date">[];
  calendar_events?: CalendarEvent[];
  activity_events?: ActivityEvent[];
  client_onboardings?: ClientOnboarding[];
}

export interface ClientOnboarding {
  id: string;
  workspace_id: string;
  company_id: string;
  project_id: string | null;
  status: string;
  progress: number;
  closing_date: string | null;
  expected_start_date: string | null;
  responsible_salesperson_id: string | null;
  initial_notes: string | null;
  contracted_services: string[] | null;
  completed_at: string | null;
  completion_override_reason: string | null;
  completion_overridden_by: string | null;
  completion_overridden_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  company?: { id: string; name: string } | null;
  project?: { id: string; name: string } | null;
  salesperson?: { id: string; name: string; email: string } | null;
  checklist_items?: OnboardingChecklistItem[];
  service_assignments?: OnboardingServiceAssignment[];
  meetings?: OnboardingMeeting[];
  contracts?: ClientContract[];
  support_group?: SupportGroup | null;
  marketing_b2b_forms?: MarketingB2BOnboardingFormSummary[];
  marketing_b2c_forms?: MarketingB2COnboardingFormSummary[];
}

export interface OnboardingChecklistItem {
  id: string;
  onboarding_id: string;
  workspace_id: string;
  task_id: string | null;
  department: string;
  title: string;
  status: "pending" | "in_progress" | "complete" | string;
  required: boolean;
  owner_id: string | null;
  due_date: string | null;
  completed_at: string | null;
  completed_by: string | null;
  notes: string | null;
  sort_order: number;
  owner?: { id: string; name: string; email: string } | null;
  completer?: { id: string; name: string; email: string } | null;
  task?: {
    id: string;
    title: string;
    description?: string | null;
    status: string;
    project_id?: string | null;
    assignee?: { id: string; name: string; email: string } | null;
  } | null;
  marketing_b2b_form?: MarketingB2BOnboardingFormSummary | null;
  marketing_b2c_form?: MarketingB2COnboardingFormSummary | null;
}

export interface OnboardingServiceAssignment {
  id: string;
  onboarding_id: string;
  workspace_id: string;
  service: string;
  leader_id: string | null;
  department_id: string | null;
  department_name: string | null;
  status: string;
  notes: string | null;
  leader?: { id: string; name: string; email: string } | null;
  department?: { id: string; name: string } | null;
}

export interface OnboardingMeeting {
  id: string;
  onboarding_id: string;
  workspace_id: string;
  service: string;
  checklist_item_id: string | null;
  scheduled: boolean;
  scheduled_at: string | null;
  meeting_url: string | null;
  leader_id: string | null;
  notes: string | null;
  leader?: { id: string; name: string; email: string } | null;
}

export interface ClientContract {
  id: string;
  onboarding_id: string;
  workspace_id: string;
  company_id: string;
  project_id: string | null;
  file_name: string;
  storage_bucket?: string;
  storage_path?: string;
  mime_type?: string | null;
  size_bytes?: number | null;
  status: string;
  visibility: string;
  uploaded_by: string;
  uploaded_at: string;
  created_at: string;
  private?: boolean;
  uploader?: { id: string; name: string; email: string } | null;
}

export interface SupportGroup {
  id: string;
  onboarding_id: string;
  workspace_id: string;
  group_created: boolean;
  group_link: string | null;
  group_created_at: string | null;
  created_by: string | null;
  internal_participants: string[] | null;
  client_participants: string[] | null;
  notes: string | null;
  creator?: { id: string; name: string; email: string } | null;
}

export interface Template {
  id: string;
  workspace_id: string;
  name: string;
  type: string;
  description: string | null;
  config: unknown;
  active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface WorkflowStatus {
  id: string;
  workspace_id: string;
  project_id: string | null;
  key: string;
  name: string;
  category: string;
  stage_order: number;
  color: string | null;
  terminal: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ApprovalRequest {
  id: string;
  workspace_id: string;
  entity_type: string;
  entity_id: string;
  title: string;
  status: string;
  stage: string;
  requested_by: string;
  approver_id: string | null;
  requested_changes: string | null;
  due_at: string | null;
  approved_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  requester?: { id: string; name: string; email: string } | null;
  approver?: { id: string; name: string; email: string } | null;
  events?: ApprovalEvent[];
}

export interface ApprovalEvent {
  id: string;
  approval_id: string;
  workspace_id: string;
  actor_id: string | null;
  from_status: string | null;
  to_status: string;
  comment: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  actor?: { id: string; name: string; email: string } | null;
}

export interface ClientReport {
  id: string;
  workspace_id: string;
  company_id: string;
  author_id: string;
  title: string;
  period_from: string;
  period_to: string;
  version: number;
  status: string;
  narrative: string | null;
  markdown: string | null;
  pdf_url: string | null;
  approved_at: string | null;
  approved_by: string | null;
  sent_at: string | null;
  sent_by: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  company?: { id: string; name: string } | null;
  author?: { id: string; name: string; email: string } | null;
  approver?: { id: string; name: string; email: string } | null;
  sender?: { id: string; name: string; email: string } | null;
}

export interface AutomationRun {
  id: string;
  workspace_id: string;
  rule_id: string | null;
  status: string;
  trigger: string;
  action_type: string;
  dry_run: boolean;
  matched: number;
  executed: number;
  skipped: number;
  failure_count: number;
  dedupe_key: string | null;
  error: string | null;
  result: Record<string, unknown> | null;
  started_at: string;
  finished_at: string | null;
  created_by: string | null;
}
