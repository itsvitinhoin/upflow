import { z } from "zod";

const BASE = "https://api.clickup.com/api/v2";
const id = z.string();
const space = z.object({ id, name: z.string(), private: z.boolean().optional() }).passthrough();
const folder = z.object({ id, name: z.string(), space: z.object({ id }).optional() }).passthrough();
const list = z.object({ id, name: z.string(), folder: z.object({ id }).optional(), space: z.object({ id }).optional() }).passthrough();
const task = z.object({
  id, name: z.string(), description: z.string().optional(), text_content: z.string().optional(),
  status: z.object({ status: z.string() }).optional(), priority: z.object({ priority: z.string() }).nullable().optional(),
  due_date: z.string().nullable().optional(), date_created: z.string().optional(), orderindex: z.string().optional(),
  parent: z.union([z.string(), z.number()]).nullable().optional(), archived: z.boolean().optional(),
  assignees: z.array(z.object({ id, username: z.string().optional(), email: z.string().email().optional() }).passthrough()).optional(),
  subtasks: z.array(z.object({ id }).passthrough()).optional(), attachments: z.array(z.object({ id, title: z.string().optional(), url: z.string().url(), extension: z.string().optional() }).passthrough()).optional(),
}).passthrough();

export type ClickUpTask = z.infer<typeof task>;
export type ClickUpList = z.infer<typeof list>;

function token(): string {
  const value = process.env.CLICKUP_API_TOKEN?.trim();
  if (!value) throw new Error("CLICKUP_API_TOKEN is not configured");
  return value;
}

async function request<T>(path: string, schema: z.ZodType<T>, params?: Record<string, string | number | boolean>): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  Object.entries(params ?? {}).forEach(([key, value]) => url.searchParams.set(key, String(value)));
  let last: unknown;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch(url, { headers: { Authorization: token(), Accept: "application/json" }, cache: "no-store", signal: controller.signal });
      if (response.status === 429 || response.status >= 500) {
        await new Promise((resolve) => setTimeout(resolve, Math.min(4_000, 300 * 2 ** attempt)));
        last = new Error(`ClickUp API ${response.status}`);
        continue;
      }
      if (!response.ok) throw new Error(`ClickUp API ${response.status}`);
      return schema.parse(await response.json());
    } catch (error) { last = error; if (attempt === 3) throw error; }
    finally { clearTimeout(timeout); }
  }
  throw last instanceof Error ? last : new Error("ClickUp request failed");
}

export async function clickupWorkspaces() { return request("/team", z.object({ teams: z.array(z.object({ id, name: z.string() }).passthrough()) })); }
export async function clickupSpaces(workspaceId: string) { return request(`/team/${workspaceId}/space`, z.object({ spaces: z.array(space) })); }
export async function clickupFolders(spaceId: string) { return request(`/space/${spaceId}/folder`, z.object({ folders: z.array(folder) })); }
export async function clickupLists(folderId: string) { return request(`/folder/${folderId}/list`, z.object({ lists: z.array(list) })); }
export async function clickupFolderlessLists(spaceId: string) { return request(`/space/${spaceId}/list`, z.object({ lists: z.array(list) })); }
export async function clickupTasks(listId: string, page: number) { return request(`/list/${listId}/task`, z.object({ tasks: z.array(task), last_page: z.boolean().optional() }), { page, include_subtasks: true, subtasks: true, archived: false }); }
export async function clickupTask(taskId: string) { return request(`/task/${taskId}`, task, { include_subtasks: true }); }
