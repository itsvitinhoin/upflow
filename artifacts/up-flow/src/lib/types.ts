export interface AppUser {
  id: string;
  name: string | null;
  email: string | null;
  image?: string | null;
  role: "admin" | "member";
  currentWorkspaceId?: string;
  currentRole?: "owner" | "admin" | "member" | null;
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
  due_date: string | null;
  created_at: string;
  owner: ProjectOwner;
  space?: { id: string; name: string; icon: string | null } | null;
  folder?: { id: string; name: string; icon: string | null } | null;
  _count: { tasks: number };
}

export interface Space {
  id: string;
  name: string;
  icon: string | null;
  owner_id: string;
  position: number;
  created_at: string;
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
  custom_field_values?: TaskCustomFieldValue[];
  _count?: { comments: number; subtasks: number };
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
  role?: "admin" | "member";
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
  role: "admin" | "member";
  avatar_url: string | null;
  created_at: string;
  workspace_role?: "owner" | "admin" | "member" | null;
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
  owner_id: string;
  created_at: string;
  updated_at: string;
  owner?: { id: string; name: string; email: string } | null;
  summary?: {
    project_count: number;
    open_task_count: number;
    overdue_task_count: number;
    meeting_count: number;
    contact_count: number;
    tracked_seconds: number;
    risk_reasons: string[];
    profitability_ratio: number | null;
    contract_value_per_tracked_hour: number | null;
    commission_per_tracked_hour: number | null;
    next_deadline: string | null;
  };
  contacts?: CompanyContact[];
  notes_log?: CompanyNote[];
  projects?: Pick<Project, "id" | "name" | "status" | "due_date">[];
  tasks?: Pick<Task, "id" | "title" | "status" | "priority" | "due_date">[];
  calendar_events?: CalendarEvent[];
  activity_events?: ActivityEvent[];
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
