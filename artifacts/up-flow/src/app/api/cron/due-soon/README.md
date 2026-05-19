# Due-soon reminder cron

Scans for tasks whose `due_date` falls within the next **24 hours** and creates
one `due_soon` notification per (task, due_date) pair. De-duped against any
existing unread `due_soon` notification for the same task+due_date, so it can
be invoked safely on any cadence.

## Trigger

`GET` or `POST /api/cron/due-soon`

Authorization (production): `Authorization: Bearer $CRON_SECRET` (or
`x-cron-secret: $CRON_SECRET`).

When `CRON_SECRET` is unset, the endpoint only accepts requests originating
from `localhost`/`127.0.0.1` so dev still works without a key.

A reasonable cadence is hourly. Recipients only see one reminder per due
date — rescheduling a task to a new due date will create a fresh reminder.
