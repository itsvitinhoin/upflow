export interface AppUser {
  id: string;
  name: string | null;
  email: string | null;
  image?: string | null;
  role: "admin" | "member";
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
  owner_id: string;
  space_id?: string | null;
  folder_id?: string | null;
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
  position: number;
  created_at: string;
  _count?: { projects: number };
}

export interface TaskAssignee {
  id: string;
  name: string;
  email: string;
}

export interface TaskProject {
  id: string;
  name: string;
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

export interface Notification {
  id: string;
  type: "assigned" | "commented" | "due_soon";
  read: boolean;
  created_at: string;
  task: NotificationTask | null;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: "admin" | "member";
  avatar_url: string | null;
  created_at: string;
  _count: { tasks: number; projects: number };
}
