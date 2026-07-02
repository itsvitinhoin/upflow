import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const ROOT = join(__dirname, "..", "..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

test("task assignee pickers are scoped to active workspace members", () => {
  const projectPage = read("src/app/(dashboard)/projects/[id]/page.tsx");
  const taskSheet = read("src/components/projects/task-detail-sheet.tsx");
  const newTaskDialog = read("src/components/projects/new-task-dialog.tsx");
  const usersRoute = read("src/app/api/users/route.ts");

  assert.match(projectPage, /\/api\/users\?workspace_id=\$\{p\.workspace_id\}&status=active/);
  assert.match(taskSheet, /\/api\/users\?workspace_id=\$\{workspaceId\}&status=active/);
  assert.match(newTaskDialog, /\/api\/users\?workspace_id=\$\{project\.workspace_id\}&status=active/);
  assert.match(usersRoute, /statusFilter/);
  assert.match(usersRoute, /membershipStatus/);
});

test("task assignment validates active members and creates assignment notifications", () => {
  const tasksRoute = read("src/app/api/tasks/route.ts");
  const taskRoute = read("src/app/api/tasks/[id]/route.ts");
  const projectAccess = read("src/lib/project-access.ts");

  assert.match(projectAccess, /status:\s*"active"/);
  assert.match(tasksRoute, /type:\s*"assigned"/);
  assert.match(taskRoute, /type:\s*"assigned"/);
  assert.match(tasksRoute, /broadcastNotification\(assignee_id\)/);
  assert.match(taskRoute, /broadcastNotification\(assignee_id\)/);
  assert.match(tasksRoute, /Assignee is not an active member with access to this project/);
  assert.match(taskRoute, /Assignee is not an active member with access to this project/);
});

test("task assignment notifications navigate to the exact assigned task", () => {
  const notificationLinks = read("src/lib/notification-links.ts");
  const header = read("src/components/layout/header.tsx");
  const inbox = read("src/app/(dashboard)/inbox/page.tsx");
  const projectPage = read("src/app/(dashboard)/projects/[id]/page.tsx");

  assert.match(notificationLinks, /new URLSearchParams\(\{\s*task:\s*notification\.task\.id\s*\}\)/);
  assert.match(notificationLinks, /\/projects\/\$\{notification\.task\.project\.id\}\?\$\{params\.toString\(\)\}/);
  assert.match(header, /getNotificationHref\(notification\)/);
  assert.match(header, /router\.push\(href\)/);
  assert.match(header, /type="button"/);
  assert.match(inbox, /getNotificationHref\(n\)/);
  assert.match(projectPage, /useSearchParams/);
  assert.match(projectPage, /searchParams\?\.get\("task"\)/);
  assert.match(projectPage, /setSelectedTask\(task\)/);
});

test("calendar attendee assignments create notifications and navigate to calendar", () => {
  const createRoute = read("src/app/api/calendar/events/route.ts");
  const updateRoute = read("src/app/api/calendar/events/[id]/route.ts");
  const helper = read("src/lib/calendar-notifications.ts");
  const notificationLinks = read("src/lib/notification-links.ts");
  const scheduleDialog = read("src/components/dashboard/schedule-meeting-dialog.tsx");

  assert.match(createRoute, /notifyCalendarEventAssignees/);
  assert.match(updateRoute, /newlyAddedAttendees/);
  assert.match(helper, /source:\s*"calendar_event_assigned"/);
  assert.match(helper, /type:\s*"assigned"/);
  assert.match(helper, /broadcastNotification\(userId\)/);
  assert.match(notificationLinks, /source === "calendar_event_assigned"/);
  assert.match(notificationLinks, /\/calendar\?\$\{params\.toString\(\)\}/);
  assert.match(scheduleDialog, /attendee_ids/);
});

test("global assistant pop-up listens for assignment broadcasts", () => {
  const header = read("src/components/layout/header.tsx");
  const translations = read("src/lib/i18n/translations.ts");

  assert.match(header, /assistantNotification/);
  assert.match(header, /channel\(`notifications:\$\{user\.id\}`\)/);
  assert.match(header, /event:\s*"new_notification"/);
  assert.match(header, /shouldShowAssistantPopup/);
  assert.match(header, /handleOpenNotification\(notification\)/);
  assert.match(translations, /header\.assistantTitle/);
  assert.match(translations, /calendar\.attendees/);
});

test("task creation dialog prevents duplicate submits and explains project context", () => {
  const newTaskDialog = read("src/components/projects/new-task-dialog.tsx");
  const createTaskPanel = read("src/components/projects/create-task-panel.tsx");
  const taskTemplates = read("src/lib/task-templates.ts");

  assert.match(taskTemplates, /getTaskTitleFromTemplateValues/);
  assert.match(taskTemplates, /TASK_TITLE_FIELD_PRIORITY/);
  assert.match(newTaskDialog, /getTaskTitleFromTemplateValues\(templateValues\)/);
  assert.match(createTaskPanel, /getTaskTitleFromTemplateValues\(templateValues\)/);
  assert.match(newTaskDialog, /Add a deliverable title or fill Objective before creating it/);
  assert.match(createTaskPanel, /Add a deliverable title or fill Objective before creating it/);
  assert.match(newTaskDialog, /if \(loading\) return/);
  assert.match(newTaskDialog, /projectSelectionLoading/);
  assert.doesNotMatch(newTaskDialog, /disabled=\{loading \|\| projectsLoading \|\| !title\.trim\(\) \|\| !selectedProject\}/);
  assert.match(newTaskDialog, /Choose the list or campaign where this task belongs/);
  assert.match(newTaskDialog, /No lists are available yet/);
  assert.match(newTaskDialog, /dashboard risk and delivery views/);
  assert.match(newTaskDialog, /projectsLoading/);
  assert.match(createTaskPanel, /if \(submitting\) return/);
  assert.match(createTaskPanel, /disabled=\{submitting\}/);
  assert.doesNotMatch(createTaskPanel, /disabled=\{submitting \|\| !title\.trim\(\)\}/);
});
