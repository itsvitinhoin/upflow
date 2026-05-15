const BASE_URL = "https://api.clickup.com/api/v2";

export class ClickUpError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export interface ClickUpTeam {
  id: string;
  name: string;
  color?: string;
  avatar?: string | null;
  members?: Array<{ user: ClickUpUser }>;
}

export interface ClickUpUser {
  id: number;
  username?: string;
  email?: string;
  color?: string;
  initials?: string;
  profilePicture?: string | null;
}

export interface ClickUpSpace {
  id: string;
  name: string;
  private?: boolean;
  avatar?: string | null;
  color?: string | null;
}

export interface ClickUpFolder {
  id: string;
  name: string;
  hidden?: boolean;
  space?: { id: string; name: string };
  lists?: ClickUpList[];
}

export interface ClickUpList {
  id: string;
  name: string;
  content?: string;
  due_date?: string | null;
  folder?: { id: string; name: string; hidden?: boolean };
  space?: { id: string; name: string };
}

export interface ClickUpStatus {
  status: string;
  type?: string; // "open" | "custom" | "closed" | "done"
  color?: string;
}

export interface ClickUpTask {
  id: string;
  name: string;
  text_content?: string | null;
  description?: string | null;
  status: ClickUpStatus;
  priority?: { priority?: string; id?: string } | null;
  assignees: ClickUpUser[];
  parent: string | null;
  due_date?: string | null;
  date_created?: string | null;
  orderindex?: string | number;
  list?: { id: string };
}

interface FetchOpts {
  token: string;
  signal?: AbortSignal;
}

async function clickupFetch<T>(path: string, opts: FetchOpts): Promise<T> {
  const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, {
      headers: {
        Authorization: opts.token,
        "Content-Type": "application/json",
      },
      signal: opts.signal,
      cache: "no-store",
    });
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("retry-after") || "2");
      await new Promise((r) => setTimeout(r, Math.min(retryAfter * 1000, 10000)));
      continue;
    }
    if (!res.ok) {
      let body = "";
      try {
        body = await res.text();
      } catch {
        // Body not readable (already consumed / network reset). Fall through
        // with empty body — the status + statusText below are enough to
        // diagnose the failure.
      }
      throw new ClickUpError(
        `ClickUp ${res.status}: ${body.slice(0, 240) || res.statusText}`,
        res.status,
      );
    }
    return (await res.json()) as T;
  }
  throw new ClickUpError("ClickUp rate-limit exceeded after retries", 429);
}

export async function getTeams(opts: FetchOpts): Promise<ClickUpTeam[]> {
  const data = await clickupFetch<{ teams: ClickUpTeam[] }>("/team", opts);
  return data.teams ?? [];
}

export async function getSpaces(teamId: string, opts: FetchOpts): Promise<ClickUpSpace[]> {
  const data = await clickupFetch<{ spaces: ClickUpSpace[] }>(
    `/team/${teamId}/space?archived=false`,
    opts,
  );
  return data.spaces ?? [];
}

export async function getFolders(spaceId: string, opts: FetchOpts): Promise<ClickUpFolder[]> {
  const data = await clickupFetch<{ folders: ClickUpFolder[] }>(
    `/space/${spaceId}/folder?archived=false`,
    opts,
  );
  return data.folders ?? [];
}

export async function getFolderlessLists(
  spaceId: string,
  opts: FetchOpts,
): Promise<ClickUpList[]> {
  const data = await clickupFetch<{ lists: ClickUpList[] }>(
    `/space/${spaceId}/list?archived=false`,
    opts,
  );
  return data.lists ?? [];
}

export async function getListsInFolder(
  folderId: string,
  opts: FetchOpts,
): Promise<ClickUpList[]> {
  const data = await clickupFetch<{ lists: ClickUpList[] }>(
    `/folder/${folderId}/list?archived=false`,
    opts,
  );
  return data.lists ?? [];
}

export async function getAllTasksForList(
  listId: string,
  opts: FetchOpts,
): Promise<ClickUpTask[]> {
  const all: ClickUpTask[] = [];
  let page = 0;
  while (true) {
    const data = await clickupFetch<{ tasks: ClickUpTask[]; last_page?: boolean }>(
      `/list/${listId}/task?archived=false&include_closed=true&subtasks=true&page=${page}`,
      opts,
    );
    const tasks = data.tasks ?? [];
    all.push(...tasks);
    if (tasks.length < 100 || data.last_page === true) break;
    page++;
    if (page > 50) break; // hard ceiling: 5000 tasks per list
  }
  return all;
}
