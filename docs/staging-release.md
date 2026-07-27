# Staging and production releases

UpFlow uses three code lanes:

```text
feature/* -> staging -> main -> controlled production release
```

Only GitHub Actions deploys the application. `vercel.json` disables all Vercel
Git-triggered deployments so a normal push cannot change the live app.

## One-time external setup

### 1. Create an isolated staging database

Use the actual UpFlow Supabase organization to create either a separate
persistent staging project or a persistent Supabase branch. It must use its
own database, Auth users, Storage, API keys, and service-role key. Never point
staging at production services or production data.

Do not initialize an empty database by running this repository's committed
Prisma migrations. The early migration history assumes an existing UpFlow
schema. Bootstrap staging once from a schema-only production clone or a
persistent Supabase branch, then verify the migration history with:

```bash
pnpm --filter @workspace/up-flow run db:migrate:status
```

Seed only safe QA users and test data after the schema has been verified.

### 2. Configure Supabase Auth and Storage for staging

In the staging Supabase project:

- Set the Site URL to `https://staging.<your-domain>`.
- Add `https://staging.<your-domain>/auth/reset` to the allowed redirect URLs.
- Create the required staging-only storage buckets, including `task-assets` and
  `client-contracts`.
- Use staging-only OAuth, email, Redis, Sentry, ClickUp, and Google Calendar
  credentials. Do not reuse their production counterparts.

### 3. Create a separate Vercel project

Create an `upflow-staging` Vercel project from this repository, with
`artifacts/up-flow` as its root directory. Attach a stable staging domain such
as `staging.<your-domain>`. Add these staging-specific environment variables:

- `DATABASE_URL` and `DIRECT_URL`
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_URL` set to the staging domain
- `CRON_SECRET`
- `REDIS_URL`, or `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
- `RESEND_API_KEY` and a safe staging `EMAIL_FROM`
- `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN`

The application runs with `NODE_ENV=production` on Vercel, so the production
required variables must all be valid staging values.

### 4. Create the GitHub staging environment

In **GitHub → Settings → Environments**, create `staging` and add:

| Type | Name | Value |
| --- | --- | --- |
| Secret | `UPFLOW_STAGING_DIRECT_URL` | Direct connection URL for the staging database |
| Secret | `VERCEL_TOKEN` | Token allowed to deploy the staging Vercel project |
| Variable | `UPFLOW_STAGING_VERCEL_ORG_ID` | Vercel team ID for the staging project |
| Variable | `UPFLOW_STAGING_VERCEL_PROJECT_ID` | The `upflow-staging` Vercel project ID |

The workflow deliberately fails if any of these are missing, rather than
falling back to production values.

### 5. Protect the release branches

Create a GitHub ruleset for `main` and another for `staging`:

- require pull requests;
- require the `Test` workflow checks to pass;
- require branches to be up to date before merge;
- block force pushes and deletions;
- do not allow bypassing the rules.

For `main`, also require at least one approval and configure the existing
`production` GitHub environment with an approver.

## Normal release flow

1. Create a `feature/<short-description>` branch from `staging`.
2. Push it and open a pull request into `staging`.
3. Merge only after CI passes. A successful `Test` run on `staging` triggers
   `.github/workflows/deploy-staging.yml`, which migrates and deploys the exact
   tested commit to the separate staging environment. Releases queue rather
   than canceling an in-progress database migration.
4. Complete a staging smoke test: sign-in, password reset, task creation,
   comments, files, and a health check.
5. Open a pull request from `staging` to `main`. Merge it only after approval
   and CI are green.
6. In GitHub Actions, run **Controlled Production Release** from `main` and
   enter `STAGING-VERIFIED` and `RELEASE`.

## Rollback

If the staging deployment fails, fix it on `staging`; production is unchanged.
If a production release fails after deployment, redeploy the prior known-good
Vercel production deployment or revert the release commit and run the
controlled production workflow again. Do not roll back database migrations
destructively; use a forward-compatible repair migration instead.
