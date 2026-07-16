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
  const taskCreator = read("src/components/projects/task-create-sheet.tsx");
  const usersRoute = read("src/app/api/users/route.ts");

  assert.match(projectPage, /\/api\/users\?workspace_id=\$\{p\.workspace_id\}&status=active/);
  assert.match(taskSheet, /\/api\/users\?workspace_id=\$\{workspaceId\}&status=active/);
  assert.match(taskCreator, /\/api\/users\?workspace_id=\$\{project\.workspace_id\}&status=active&limit=500/);
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

test("onboarding assignment notifications prefer the department task over the client profile", () => {
  const notificationLinks = read("src/lib/notification-links.ts");
  const taskRouteIndex = notificationLinks.indexOf("notification.task?.project?.id");
  const onboardingFallbackIndex = notificationLinks.indexOf('data?.source?.startsWith("client_onboarding")');

  assert.notEqual(taskRouteIndex, -1);
  assert.notEqual(onboardingFallbackIndex, -1);
  assert.ok(taskRouteIndex < onboardingFallbackIndex);
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
  assert.match(header, /role="alert"/);
  assert.match(header, /aria-live="assertive"/);
  assert.match(header, /header\.assistantStickyHint/);
  assert.doesNotMatch(header, /ASSISTANT_POPUP_TTL_MS/);
  assert.doesNotMatch(header, /setTimeout\(\(\) => \{\s*setAssistantNotification\(null\)/);
  assert.match(translations, /header\.assistantTitle/);
  assert.match(translations, /header\.assistantStickyHint/);
  assert.match(translations, /calendar\.attendees/);
});

test("unified task creator requires an explicit title and prevents duplicate submits", () => {
  const taskCreator = read("src/components/projects/task-create-sheet.tsx");

  assert.match(taskCreator, /const cleanTitle = title\.trim\(\)/);
  assert.doesNotMatch(taskCreator, /getTaskTitleFromTemplateValues/);
  assert.match(taskCreator, /setTitleError\(t\("task\.titleRequired"\)\)/);
  assert.match(taskCreator, /if \(submitting\) return/);
  assert.match(taskCreator, /projectsLoading/);
  assert.match(taskCreator, /t\("task\.projectRequired"\)/);
  assert.match(taskCreator, /t\("task\.noListsAvailable"\)/);
  assert.match(taskCreator, /defaultStatus\?: Task\["status"\]/);
  assert.match(taskCreator, /defaultTemplateId\?: TaskTemplateId/);
  assert.match(taskCreator, /defaultDueDate\?: string/);
  assert.match(taskCreator, /initialCustomFieldValues\?: Record<string, unknown>/);
  assert.match(taskCreator, /onCreated: \(task: Task\) => void/);
  assert.match(taskCreator, /setDiscardOpen\(true\)/);
});
