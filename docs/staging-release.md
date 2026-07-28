# Staging and production releases

UpFlow uses three code lanes:

```text
feature/* -> staging -> main -> controlled production release
```

Only GitHub Actions deploys the application. `vercel.json` disables all Vercel
Git-triggered deployments so a normal push cannot change the live app.

## Bootstrap order

1. Merge the release-safeguards pull request into `main`, then create and
   protect `staging` from that version of `main`.
2. Create the isolated persistent Supabase `staging` branch (or a separate
   staging project). It must never share production credentials or data.
3. Merge the **staging Prisma baseline guard** into `main`, then merge a
   `main` -> `staging` pull request so the guard and manual workflow exist on
   both protected branches. GitHub reads manual and `workflow_run` workflow
   definitions from the default branch, so merging to `staging` alone cannot
   make the bootstrap runnable.
4. The current staging database was cloned from source commit
   `3e0987b16e2a4490fae20400a7722728168a5701` and has no Prisma history.
   Baseline that exact, data-less cloned schema once using the manual workflow
   below. Do not add the normal staging database secret before that workflow
   succeeds.
5. Configure the normal staging deployment secret and the separate Vercel
   project only after the baseline is verified.

## Staging clone migration-history baseline

A dashboard-created Supabase branch clones schema but is data-less. It can
therefore contain all UpFlow tables while `public._prisma_migrations` has zero
rows. That is expected for a clone, but it is **not** safe for `prisma migrate
deploy`: Prisma would regard the whole repository history as pending and try
to replay it onto tables that already exist.

The repository contains a frozen, checksummed 48-migration baseline manifest
for source commit `3e0987b16e2a4490fae20400a7722728168a5701`. It intentionally
does not include newer staging migrations, such as the later client sales-channel
migration. The manual **Baseline cloned staging Prisma history** workflow checks
out that frozen source snapshot and validates all of the following before it
records any history:

- it was dispatched from `staging`, with the exact confirmation text;
- both supplied URLs identify the staging project pinned in the reviewed
  manifest and use either the
  direct `db.<staging-ref>.supabase.co:5432` endpoint or its Supavisor session
  endpoint on port 5432; production and unknown projects are rejected;
- the frozen migration files and their checksums exactly match the reviewed
  baseline;
- the frozen source commit is an ancestor of the selected `staging` commit;
- the frozen source schema (not the newer staging checkout) matches the staging
  database;
- every UpFlow application table is empty, required PostgreSQL extensions
  exist, the explicitly protected `SidebarSpaceHide` table has RLS enabled,
  and `anon` / `authenticated` have no direct public table privileges.

Only after those checks pass does it run `prisma migrate resolve --applied` for
each frozen migration. It never runs `migrate deploy`, `db push`, a reset,
seed, Vercel deployment, or production connection. A failed run can resume
only when its existing history is an exact, finished prefix of the same frozen
list. After that bootstrap, the normal staging release applies only migrations
added after the frozen source snapshot.

## One-time external setup

### 1. Create an isolated staging database

Use the actual UpFlow Supabase organization to create either a separate
persistent staging project or a persistent Supabase branch. It must use its
own database, Auth users, Storage, API keys, and service-role key. Never point
staging at production services or production data.

Do not initialize an empty database by replaying this repository's committed
Prisma migrations. The early history assumes an existing UpFlow schema. For a
dashboard-created persistent branch, use the guarded baseline procedure below
instead of `db:migrate:deploy` or `PRISMA_BASELINE_EXISTING_DB=1`. If the clone
does not match the frozen source commit above, stop and recreate or separately
review it; do not mark its newer schema as if the frozen history had run.

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
required variables must all be valid staging values. The release workflow uses
`vercel deploy --prod` only after explicitly selecting this separate
`upflow-staging` project; in that context, `--prod` updates the stable staging
domain, never the live UpFlow production project.

### 4. Baseline the cloned schema through a separate GitHub environment

In **GitHub → Settings → Environments**, create `staging-bootstrap`. It is
intentionally separate from normal deployments. Add only:

| Type | Name | Value |
| --- | --- | --- |
| Secret | `UPFLOW_STAGING_BASELINE_MIGRATION_URL` | A direct URL, or Supavisor **session** URL for the isolated staging database only |

Do **not** add `UPFLOW_STAGING_MIGRATION_URL` to the normal `staging`
environment yet. The bootstrap environment contains no Vercel credentials and
no production database URL or mutable database identity variables. The reviewed
baseline manifest pins the only staging database it may touch.

Then, in GitHub Actions:

1. Open **Baseline cloned staging Prisma history**.
2. Choose the `staging` branch.
3. Enter `BASELINE-STAGING-PRISMA-HISTORY` exactly and run it.
4. Wait for both validation and baseline completion to pass. If it fails,
   correct or recreate the staging clone; do not bypass it or insert rows into
   `_prisma_migrations` manually.

### 5. Create the normal GitHub staging environment

After the bootstrap workflow has passed, create/configure `staging` and add:

| Type | Name | Value |
| --- | --- | --- |
| Secret | `UPFLOW_STAGING_MIGRATION_URL` | Direct URL, or Supavisor **session** URL for the staging database migration runner |
| Secret | `VERCEL_TOKEN` | Token allowed to deploy the staging Vercel project |
| Variable | `UPFLOW_STAGING_VERCEL_ORG_ID` | Vercel team ID for the staging project |
| Variable | `UPFLOW_STAGING_VERCEL_PROJECT_ID` | The `upflow-staging` Vercel project ID |

The workflow deliberately fails if any of these are missing or if the project
ID is the known UpFlow production Vercel project. Use a staging-only Vercel
token whenever possible; otherwise protect the `staging` GitHub environment so
only release owners can change its variables or deploy.

GitHub Actions is IPv4-only while Supabase direct database endpoints are IPv6
unless the IPv4 add-on is enabled. Use the Supavisor **session** connection URL
on port `5432` for GitHub Actions when the project does not have that add-on;
do not use the transaction pooler on port `6543` for Prisma migrations.

### 6. Protect the release branches

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
   tested commit to the separate staging environment. It first verifies the
   frozen baseline, so it fails closed rather than replaying history onto an
   unbaselined clone. Releases queue rather than canceling an in-progress
   database migration.
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
