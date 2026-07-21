export interface SidebarProjectTodoCount {
  _count: {
    tasks: number;
  };
}

export function countPendingTodoTasks(projects: SidebarProjectTodoCount[]) {
  return projects.reduce((total, project) => total + project._count.tasks, 0);
}

export interface SidebarProjectPendingTodoTaskCount {
  project_id: string;
  _count: {
    _all: number;
  };
}

export function addProjectPendingTodoCounts<T extends { id: string }>(
  projects: T[],
  taskCounts: SidebarProjectPendingTodoTaskCount[],
): Array<T & { pending_todo_count: number }> {
  const countByProjectId = new Map(
    taskCounts.map((taskCount) => [taskCount.project_id, taskCount._count._all]),
  );

  return projects.map((project) => ({
    ...project,
    pending_todo_count: countByProjectId.get(project.id) ?? 0,
  }));
}
