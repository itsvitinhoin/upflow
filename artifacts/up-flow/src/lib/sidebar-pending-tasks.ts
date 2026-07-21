export interface SidebarProjectTodoCount {
  _count: {
    tasks: number;
  };
}

export function countPendingTodoTasks(projects: SidebarProjectTodoCount[]) {
  return projects.reduce((total, project) => total + project._count.tasks, 0);
}
