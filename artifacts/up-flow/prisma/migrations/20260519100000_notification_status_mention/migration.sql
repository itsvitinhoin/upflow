-- Add new notification types for task status transitions and @mentions in
-- comments. The existing `due_soon` value is reused by the scheduled
-- due-date reminder job.

ALTER TYPE "NotificationType" ADD VALUE 'status_changed';
ALTER TYPE "NotificationType" ADD VALUE 'mentioned';
