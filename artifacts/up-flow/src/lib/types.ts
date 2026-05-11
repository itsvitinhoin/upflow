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
  due_date: string | null;
  created_at: string;
  owner: ProjectOwner;
  _count: { tasks: number };
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
  _count?: { comments: number; subtasks: number };
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
