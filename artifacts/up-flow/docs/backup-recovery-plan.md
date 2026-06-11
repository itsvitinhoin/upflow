# UP Flow Backup And Recovery Plan

This plan covers the minimum operational recovery process for internal rollout.

## Supabase Backups

Before company-wide rollout:

- Confirm Supabase backups are enabled for the production project.
- Confirm backup retention duration.
- Confirm who has permission to restore a backup.
- Record the latest successful backup timestamp before major migrations.

## Vercel Rollback

If a production deployment breaks the app:

1. Open Vercel project `upflow`.
2. Go to Deployments.
3. Select the last known good production deployment.
4. Use Instant Rollback or Promote to Production.
5. Confirm `/api/health` and `/admin/health`.

Rollback does not undo database migrations. If the failure is schema-related, restore or repair the database separately.

## Database Recovery

Use database restore only for severe data loss or destructive migration mistakes.

Steps:

1. Stop non-essential writes by pausing rollout activity.
2. Identify restore point.
3. Export current production data if possible.
4. Restore from Supabase backup.
5. Run `npm run db:migrate:deploy` if the restored database is behind the current app.
6. Redeploy Vercel.
7. Run final acceptance test.

## Emergency Contacts

Maintain an internal list outside the repository with:

- Supabase owner.
- Vercel owner.
- Resend owner.
- GitHub repository owner.
- UP Flow product owner.

Do not store credentials in this repository.
