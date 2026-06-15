# UP Flow CRUD QA Checklist

Use this checklist in production before marking a module ready for internal use. Run it with one workspace admin and one normal member account. Do not mark a row passed unless it was tested with real production data and the page was reloaded after mutation.

## Preconditions

- `/api/health` returns `200`.
- `/admin/health` is green for the admin account.
- Latest migrations are applied.
- Production environment variables are loaded after redeploy.
- Test workspace, test client, and test project can be safely deleted.
- Test member account is not a workspace admin unless the unauthorized test explicitly needs an admin.

## Pass Criteria

For every module, confirm:

- Can I create it?
- Can I edit it?
- Can I delete it?
- Does it persist after reload?
- Does the UI show loading, success, and error feedback?
- Does it block invalid input?
- Does it block unauthorized users?

## Module Matrix

| Module | Create | Edit | Delete | Persist after reload | UI feedback | Invalid input blocked | Unauthorized blocked | Notes |
|---|---|---|---|---|---|---|---|---|
| Spaces | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | Create from sidebar plus button. Verify sidebar and Space page refresh without manual reload hacks. |
| Folders | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | Test nested folder create/move behavior. Deleting a parent should move child folders/lists up one level. |
| Lists/projects | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | Create inside Space and Folder. Verify project opens in board view by default. |
| Tasks | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | Test title validation, assignee, due date, priority, cover image, comments, custom fields, and task assignment notification. |
| Clients | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | Test client card fields, plan/service fields, contract value, commission, linked projects/tasks, and risk empty states. |
| Calendar events | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | Create in Manage mode for a future date. Verify Brazilian date display and timezone. Tasks due on calendar remain read-only. |
| Notes | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | Test client notes. Note author, client owner, and workspace admins can manage notes; unrelated members should be blocked. |
| Contacts | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | Test client contacts. Client owner and workspace admins can edit/delete contacts; invalid emails are rejected. |
| Team members | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | Invite current-workspace member, change role/status/department, remove/deactivate, then verify team list after reload. |
| Departments | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | Create, rename, recolor, delete. Deleting a department should move members to Unassigned. |

## Unauthorized Access Checks

Run these with a normal member:

- Try to delete a task they do not own and are not allowed to delete.
- Try to edit/delete a client they do not own when workspace policy requires owner/admin.
- Try to manage workspace departments.
- Try to remove or promote another team member.
- Try to open a record URL from another workspace.

Expected result: the API returns `403` or `404`, and the UI shows a clear permission or not-found message without changing local state.

## Invalid Input Checks

- Space/folder/project/client/task/contact/note names cannot be empty.
- Contact email must be a valid email address when provided.
- Calendar event end time cannot be before start time.
- Date inputs display Brazilian format where user-facing.
- Duplicate submissions are blocked while a create/save/delete request is pending.

## Cleanup

After the test:

- Delete temporary tasks, projects, folders, spaces, calendar events, clients, notes, and contacts.
- Remove or deactivate temporary team members.
- Confirm dashboard counts return to the expected baseline.
