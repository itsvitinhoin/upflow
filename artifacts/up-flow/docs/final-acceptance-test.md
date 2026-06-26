# UP Flow Final Acceptance Test

Run this in production before marking UP Flow ready for internal rollout. Use real accounts and a temporary test client/project that can be deleted afterward.

## Preconditions

- `/api/health` returns healthy.
- `/admin/health` shows `Ready for internal rollout`.
- Production env vars are configured.
- Latest Prisma migration is applied.
- Resend email sender is verified.
- Supabase Storage has a public task asset bucket named `task-assets`, or `TASK_ASSETS_BUCKET` points to the configured bucket.
- Test users have access to their email inboxes.

## Acceptance Flow

1. Invite a user to the current workspace.
   - Expected: invite email is delivered.
   - Expected: invite appears as pending before acceptance.

2. Invite a user to use UP Flow with their own workspace.
   - Expected: the user does not appear as an Admin workspace member.
   - Expected: copy clearly explains that this creates/uses their own workspace.

3. User creates account from invite.
   - Required fields: email, full name, cellphone, password.
   - Expected: account is created and profile name is not replaced by phone number.

4. User accepts invite.
   - Expected: current-workspace invite lands inside the invited workspace.
   - Expected: personal-workspace invite lands inside the user-owned workspace.
   - Expected: invalid, expired, or already-used invites show clear errors.

5. User logs out.
   - Expected: session clears and user returns to login.

6. User logs in again.
   - Expected: login succeeds and active workspace is correct.

7. Admin creates a Space.
   - Expected: Space appears in sidebar without refresh hacks.

8. Admin creates a folder inside the Space.
   - Expected: folder appears in sidebar and Browse tab.

9. Admin creates a list/project inside the folder.
   - Expected: project opens in board view by default.

10. Admin creates a task.
    - Expected: validation prevents empty title.
    - Expected: submit disables during creation.
    - Expected: task appears on the board.
    - Expected: uploaded cover image persists as a URL and appears after reload.

11. Admin assigns another user to the task.
    - Expected: only active workspace members are selectable.
    - Expected: assigned user receives a notification.

12. Assigned user opens notification.
    - Expected: notification opens the correct task.

13. Admin edits task.
    - Expected: status, priority, assignee, due date, description, comments, subtasks, and cover image save correctly.

14. Admin deletes task.
    - Expected: destructive confirmation appears.
    - Expected: members and guests cannot delete or mutate tasks under the current policy.

15. Admin creates a client.
    - Expected: client card shows real available data and safe empty states for missing plan/service fields.

16. Admin links work to client where supported.
    - Expected: client detail reflects linked projects/tasks.

17. Admin creates Calendar event.
    - Expected: date is displayed as Brazilian format `dd/mm/yyyy`.
    - Expected: timezone uses `America/Sao_Paulo`.

18. Admin edits and deletes Calendar event.
    - Expected: admin succeeds.
    - Expected: member and guest users see a clear permission error.

19. Admin starts time tracking.
    - Expected: running timer persists after reload.
    - Expected: only one running timer exists for the user.
    - Expected: member and guest users cannot start timers under the current policy.

20. Admin stops time tracking.
    - Expected: Today, This Week, and Daily Average use real `TimeEntry` records.

21. User views home dashboard.
    - Expected: every visible count opens traceable records.
    - Expected: risk cards do not claim unsupported blocker or due-date history logic.

22. User views Space dashboard.
    - Expected: records are scoped to the selected Space.
    - Expected: department-specific copy appears when applicable.
    - Expected: members and guests can view workspace and space records without create/edit/delete controls.

23. Owner opens workspace options and sees the delete workspace action.
    - Expected: workspace deletion is owner-only and protects the user's only workspace.
    - Expected: admin, member, and guest users do not see a usable delete workspace action.

24. Mobile viewport test.
    - Expected: dashboard, team, projects, board, calendar, clients, client detail, spaces, folders, and task sheet have no page-level horizontal overflow.

## Final Verdict

Mark one:

- Not ready: any P0 acceptance step fails.
- Ready for admin-only testing: health is green and admin acceptance flow passes.
- Ready for department pilot: admin testing passes and one user from each pilot department can complete core flows.
- Ready for company-wide rollout: department pilot passes for one full week without P0 blockers.
