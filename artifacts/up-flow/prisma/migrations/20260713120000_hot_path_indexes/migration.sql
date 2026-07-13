CREATE INDEX "WorkspaceMember_workspace_id_status_idx" ON "WorkspaceMember"("workspace_id", "status");
CREATE INDEX "WorkspaceMember_workspace_id_status_department_id_idx" ON "WorkspaceMember"("workspace_id", "status", "department_id");

CREATE INDEX "Space_workspace_id_position_created_at_idx" ON "Space"("workspace_id", "position", "created_at");
CREATE INDEX "Folder_workspace_id_position_created_at_idx" ON "Folder"("workspace_id", "position", "created_at");

CREATE INDEX "Project_workspace_id_status_due_date_idx" ON "Project"("workspace_id", "status", "due_date");
CREATE INDEX "Project_workspace_id_space_id_created_at_idx" ON "Project"("workspace_id", "space_id", "created_at");
CREATE INDEX "Project_workspace_id_folder_id_created_at_idx" ON "Project"("workspace_id", "folder_id", "created_at");

CREATE INDEX "Task_project_id_status_position_idx" ON "Task"("project_id", "status", "position");
CREATE INDEX "Task_project_id_parent_id_idx" ON "Task"("project_id", "parent_id");
CREATE INDEX "Task_assignee_id_status_due_date_idx" ON "Task"("assignee_id", "status", "due_date");
CREATE INDEX "Task_company_id_status_due_date_idx" ON "Task"("company_id", "status", "due_date");
CREATE INDEX "Task_parent_id_idx" ON "Task"("parent_id");
CREATE INDEX "Task_due_date_idx" ON "Task"("due_date");

CREATE INDEX "TimeEntry_workspace_id_user_id_status_started_at_idx" ON "TimeEntry"("workspace_id", "user_id", "status", "started_at");

CREATE INDEX "ActivityEvent_workspace_id_project_id_created_at_idx" ON "ActivityEvent"("workspace_id", "project_id", "created_at");
CREATE INDEX "ActivityEvent_workspace_id_company_id_created_at_idx" ON "ActivityEvent"("workspace_id", "company_id", "created_at");

CREATE INDEX "Company_workspace_id_status_updated_at_idx" ON "Company"("workspace_id", "status", "updated_at");
CREATE INDEX "Company_workspace_id_contract_value_idx" ON "Company"("workspace_id", "contract_value");

CREATE INDEX "Comment_task_id_created_at_idx" ON "Comment"("task_id", "created_at");
CREATE INDEX "Comment_parent_id_idx" ON "Comment"("parent_id");

CREATE INDEX "Notification_user_id_read_created_at_idx" ON "Notification"("user_id", "read", "created_at");
CREATE INDEX "Notification_workspace_id_user_id_created_at_idx" ON "Notification"("workspace_id", "user_id", "created_at");
