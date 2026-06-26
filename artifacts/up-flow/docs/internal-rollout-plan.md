# UP Flow Internal Rollout Plan

UP Flow should replace the current project-management system only after controlled rollout. Do not invite the full company until admin testing and a department pilot are stable.

## Phase 1: Admin-Only Testing

Owners:

- Product owner.
- Technical admin.

Goal:

- Validate every core workflow with real production configuration and low data risk.

Required checks:

- Admin Health is ready.
- Invite flow works for current-workspace users.
- Personal-workspace invite flow is understood and does not add users to Admin workspace.
- Owners/admins can create and clean up spaces, folders, lists, tasks, clients, calendar events, notes, contacts, departments, and time entries.
- Members and guests can view workspace records without mutating them.
- Workspace deletion is owner-only and cannot remove the user's only workspace.
- Assignment notifications are created and open the correct task.
- Logout works.

Exit criteria:

- No P0 blockers remain.
- Final acceptance test passes for at least one admin.

## Phase 2: Department Pilot

Invite one representative from each department:

- Comercial.
- Finance.
- Creative & Design.
- Production.
- Technical Support.
- General Admin.

Pilot length:

- One full work week.

Pilot rules:

- Use real work, not demo-only records.
- Keep the current project-management system available as fallback.
- Track every issue with severity: blocker, high, medium, low.
- Do not migrate old clutter unless it is required for active work.

Exit criteria:

- Each department can create and manage its real work.
- No permission leakage between workspaces.
- No critical workflow depends on unavailable mock/localStorage data.
- Support questions are documented.

## Phase 3: Data Migration

Decide what must move:

- Active clients.
- Active projects/campaigns.
- Open tasks.
- Current team members and departments.
- Recurring routines that must not be missed.

Avoid importing:

- Completed stale tasks.
- Old abandoned lists.
- Duplicate client records.
- Historical notes that nobody uses.

Migration acceptance:

- Imported clients have service/plan information where available.
- Open tasks have owner, status, priority, and due date where available.
- Department Spaces are clean and usable.

## Phase 4: Company-Wide Rollout

Before inviting everyone:

- Admin Health is green.
- Department pilot issues are resolved or accepted.
- Training material is ready.
- Old system freeze date is announced.

Training topics:

- Workspace switching.
- Spaces and department dashboards.
- Projects/lists.
- Task creation, assignment, comments, subtasks, and cover images.
- Clients.
- Calendar.
- Time tracking.
- Notifications.
- Language toggle.

## Phase 5: Retire Old System

Keep the old system read-only for 2 to 4 weeks.

During read-only period:

- New work must be created in UP Flow.
- Old system is used only for lookup.
- Missing critical records are migrated manually.

Final cutoff:

- Disable new edits in the old system.
- Export old-system backup.
- Document where the backup is stored.
