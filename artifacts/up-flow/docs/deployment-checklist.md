# UP Flow Deployment Checklist

Use this checklist before every production deployment. UP Flow is an internal operations system, so deploys must protect production data and avoid partial schema/app mismatches.

## 1. Required Vercel Production Environment

Confirm these variables exist in the Vercel `Production` environment:

- `DATABASE_URL`: Supabase pooler Postgres connection string for application runtime.
- `DIRECT_URL`: direct Supabase Postgres connection string for Prisma migrations. This must be a Postgres URL, not the Supabase HTTPS project URL.
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase public anon key.
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key for admin invite/account flows. Never expose this client-side.
- `APP_URL`: canonical public app URL, for example `https://upflow-mocha.vercel.app`.
- `RESEND_API_KEY`: Resend API key for transactional invite/password emails.
- `EMAIL_FROM`: verified sender, for example `Up Flow <no-reply@yourdomain.com>`.
- `CRON_SECRET`: random shared secret used by production cron endpoints.
- `SENTRY_DSN`: server-side error tracking DSN, or set `OBSERVABILITY_DISABLED=1` only for an explicitly accepted internal rollout without error tracking.
- `TASK_ASSETS_BUCKET`: optional Supabase Storage bucket name for task cover images. Defaults to `task-assets`.

Also confirm these values do not contain placeholders such as `[YOUR-PASSWORD]`.
For production rate limiting, configure either `REDIS_URL` or both `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`; otherwise each server instance falls back to an in-memory limiter.

Create a public Supabase Storage bucket named `task-assets` unless `TASK_ASSETS_BUCKET` points to a different public bucket. Task cover image uploads store only the public URL in Postgres.

## 2. Secret Rotation

Rotate and update Vercel if any secret was pasted into chat, logs, screenshots, or shared documents:

- Supabase database password.
- Supabase service role key.
- Resend API key.
- Any Vercel tokens or deploy credentials.

After rotation, redeploy and confirm `/admin/health` is green.

## 3. Run Migrations Before Redeploy

Run in this order:

1. Deploy migrations against production:

   ```bash
   npm run db:migrate:deploy
   ```

2. Redeploy the Vercel app from `main`.

3. Confirm health:

   - `GET /api/health` returns `status: "ok"`.
   - `/admin/health` shows `Ready for internal rollout`.

Do not reverse this order when the commit contains Prisma schema changes.

## 4. Post-Deploy Smoke Test

After Vercel is ready, validate:

- Login succeeds.
- Logout succeeds.
- Dashboard loads without a generic error boundary.
- Team page loads members for the active workspace.
- Create a temporary Space, folder, list, and task.
- Upload a task cover image and confirm it appears on the board card after reload.
- Assign a task and confirm notification creation.
- Create and delete a Calendar event.
- Create and delete a client note/contact.
- Start and stop a time entry.

Clean up temporary records after the smoke test.

## 5. Go / No-Go

Go only when:

- `/api/health` is healthy.
- `/admin/health` is ready.
- Final acceptance test passes.
- At least one admin can complete invite, task, calendar, client, and time tracking flows in production.

No-go when:

- Production database is unreachable.
- Migration history is behind the app bundle.
- Invite email cannot be delivered by Resend.
- Task image storage bucket is missing or not readable.
- Logout/login fails.
- Workspace isolation or role permissions fail.
