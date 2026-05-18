# Up Flow — Internal PM Tool

Up Flow is a ClickUp-style project management tool living in the `artifacts/up-flow` package of this pnpm monorepo. Stack: Next.js 14 (App Router) + Prisma + PostgreSQL, Supabase Auth, Tailwind v3, shadcn/ui, dark theme only.

## Project structure

- `artifacts/up-flow` — the Next.js app (this is the primary artifact)
- `artifacts/api-server` — shared Express service (unrelated to up-flow)
- `artifacts/mockup-sandbox` — canvas/UI prototyping (unrelated to up-flow)
- `prisma/schema.prisma` and `prisma/migrations/*` — DB schema lives inside `artifacts/up-flow/prisma`

## Required environment variables

These must be set in any environment that runs Up Flow. In production the server will refuse to start if any are missing.

| Var | Where set | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Replit secret / `.env.local` | Postgres connection string used by Prisma |
| `NEXT_PUBLIC_SUPABASE_URL` | Replit secret / `.env.local` | Supabase project URL (client + server) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Replit secret / `.env.local` | Supabase anon key for browser auth |
| `SUPABASE_SERVICE_ROLE_KEY` | Replit secret | Required for admin invite-style user registration |
| `ADMIN_EMAILS` | Replit secret / `.env.local` | Comma-separated email allowlist of users auto-promoted to `admin`. Defaults to `admin@upflow.io` if unset (dev only) |
| `CLICKUP_API_TOKEN` | Optional | Default token for the admin ClickUp import |
| `TEST_LOGIN_TOKEN` | `.env.local` (dev) / GitHub Actions secret (CI) | Enables the Playwright login bypass route. **Must be unset in production** — the bypass is also hard-gated on `NODE_ENV !== "production"`. In CI, set as a repository secret named `TEST_LOGIN_TOKEN` (Settings → Secrets and variables → Actions); the workflow fails fast if it's missing |

## Running tests

End-to-end tests live in `artifacts/up-flow/tests/` and exercise the JSON API (Playwright `request` fixture — no browser needed) plus one optional UI smoke that auto-skips when Chromium can't launch (e.g. the Replit Nix sandbox lacks `glib`).

```bash
# one-off browser download (optional — only used by ui.spec.ts)
pnpm --filter @workspace/up-flow run test:e2e:install

# run the suite against the running dev server (workflow `artifacts/up-flow: web`)
pnpm --filter @workspace/up-flow run test:e2e
```

Requirements: the dev workflow must be running, `TEST_LOGIN_TOKEN` must be set in `.env.local`, and the seeded users `admin@upflow.io` / `sarah@upflow.io` must exist (see `scripts/seed.ts`, run via `pnpm --filter @workspace/up-flow run db:seed`). The `test:e2e` script reuses the live dev server on `http://localhost:80`; override with `PLAYWRIGHT_BASE_URL` if needed.

### CI

`.github/workflows/test.yml` runs the suite on every push and pull request. The job spins up a fresh Postgres 16 service, applies migrations, seeds the database, installs Playwright + Chromium system deps, boots the Next.js dev server (`PLAYWRIGHT_START_SERVER=1`), and runs `pnpm --filter @workspace/up-flow run test:e2e`. The UI smoke (`tests/ui.spec.ts`) only auto-skips locally when Chromium fails to launch; in CI (`process.env.CI` is set) it hard-fails instead, so a broken UI smoke can't ship silently. The job fails fast if the `TEST_LOGIN_TOKEN` repository secret is missing and uploads `playwright-report` + `test-results` as artifacts on failure.

The login bypass is implemented in three places: `POST /api/auth/test-login` mints an HMAC-signed `upflow_test_user` cookie; `middleware.ts` lets requests through when the cookie is shape-valid (Edge runtime can't always read env vars, so the real HMAC check happens server-side); `getAuthResult()` and `app/(dashboard)/layout.tsx` do the actual signature verification before granting access. The whole mechanism is a no-op in production.

### Interactivity coverage

`tests/ui/` contains real-Chromium Playwright specs that exercise every
interactive control on the dashboard, organised by area:

- `tests/ui/global-chrome.spec.ts` — sidebar rail navigation (Dashboard /
  Projects / Calendar / Inbox / Time / Team), each landing route checked
  AND the rail's active-state indicator (`<span>` dot inside the active
  link) asserted; the "Toggle spaces" rail button is clicked twice and
  its `aria-pressed` attribute is verified to flip and restore; workspace
  switcher: open the dropdown, click a second workspace and assert
  `POST /api/workspaces/switch` fires (routes stubbed), then reopen and
  exercise "New workspace"; header `<input type="search">` → `/search?q=…`;
  ⌘K command palette open/filter/Enter-navigates; notification bell —
  `/api/notifications` is stubbed with two unread items so "Mark all read" is
  deterministic and asserted to disappear after click; header "+ New
  Project" dialog.
- `tests/ui/dashboard.spec.ts` — all five quick-action buttons open their
  dialogs; each stat card (Upcoming / In progress / Completed) toggles
  `aria-pressed` AND swaps the filtered-list heading; happy-path
  submission for Invite to Team (emails filled, `POST /api/invites`
  stubbed), Schedule Meeting (title + color tag), Create a Company
  (name + domain), AND Create Task (pick seeded project, fill title,
  POST /api/tasks asserted before dialog dismiss); task-row "Actions
  for …" menu Mark-done, Edit / details (opens the detail modal), and
  Delete (with `window.confirm` accepted); progress widget "+ New Task";
  happy-path New Project create that ends with the project on `/projects`.
- `tests/ui/projects.spec.ts` — `/projects` header "+ New Project"; the
  hover-revealed "Move" button opens `MoveToSpaceDialog`; project-detail
  `ProjectToolbar` list↔board toggle, inline `Search tasks…` filter,
  Group / Sort / Filter (priority + assignee) dropdowns, Columns toggle,
  Show closed, sort-direction button; kanban drag-and-drop between columns
  using `@hello-pangea/dnd`'s keyboard sensor (Space → ArrowRight → Space)
  with `waitForResponse('/reorder-tasks')` before reload; task detail
  sheet edits title + status select + priority select + due date +
  assignee select and posts a comment via `POST /api/comments`;
  list-view inline custom-field editor (seeds a "Notes" text definition
  via the admin API, asserts the `PUT /api/tasks/:id/custom-fields`
  fires on blur); list-view group chevron collapse and the row
  completion checkbox (`title="Toggle complete"`) PATCH.
- `tests/ui/secondary-pages.spec.ts` — Calendar Today / Previous / Next
  navigation + day-cell selection + a "Due tasks" link click that
  navigates to `/projects/:id` (task seeded with `due_date: today`);
  Time tracking summary cards + the 7 weekly bars (hover a bar and
  assert its native `title` tooltip matches `"Mon: 0h 30m"` shape) +
  per-project breakdown row; Inbox filter tabs + "Mark all read" +
  per-row "Mark read" (notifications routes stubbed); Team table with
  the seeded admin row hovered (and a conditional role-select interaction
  exercised if one is rendered); header search → `/search?q=` end-to-end
  + clicking the project result navigates.
- `tests/ui/settings-import.spec.ts` — ClickUp import: connect → preview →
  start with `/api/clickup/*` stubbed via `page.route()` (no real ClickUp
  account needed), and a 4xx response surfaces a Sonner toast.

All UI specs share `tests/ui/_ui-helpers.ts` which provides
`requireChromiumOrSkip()` (skips the whole describe block locally when
Chromium can't launch — e.g. the Replit Nix sandbox lacks `glib` — but
throws hard in CI so a broken UI suite cannot ship silently),
`loggedInContext(browser, baseURL, email)` (cookie-based login via
`/api/auth/test-login`), and `createProjectViaApi` / `createTaskViaApi`
seed helpers so each spec is hermetic.

## Deploying

Deploy is autoscale. The production pipeline is:

1. **Build** — `pnpm --filter @workspace/up-flow run build` (runs `prisma generate && next build`).
2. **Start** — `pnpm --filter @workspace/up-flow run start` (runs `prisma migrate deploy && next start`).

Database migrations run automatically before the server starts accepting traffic. If a migration fails the deploy fails fast.

## Auth model

- Supabase Auth is the only auth stack. The legacy `next-auth` library and `[...nextauth]` route have been removed.
- Registration is **admin-only**: the login page no longer exposes public sign-up. New users are provisioned by an admin via `/api/users/register` (which calls `supabase.auth.admin.createUser`). For belt-and-braces protection, also disable public sign-ups in the Supabase project's Auth settings.
- A user is auto-promoted to `admin` on first login only if their email appears in `ADMIN_EMAILS`. In production, an unset `ADMIN_EMAILS` means no one is auto-promoted (no fallback admin). In dev, `admin@upflow.io` is used as a convenience seed.
- Admins are the only role that can: create users via `/api/users/register`, manage custom fields, and use any `/api/clickup/*` endpoint.

## Security hardening currently in place

- Fail-fast env validation (`src/lib/env.ts`).
- In-process per-IP rate limiting (`src/lib/rate-limit.ts`) on `/api/auth/login`, `/api/users/register`, `/api/search`.
- Strict response headers: `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, baseline CSP with no inline scripts, `Permissions-Policy` denying camera/mic/geolocation.
- ClickUp import + preview + teams routes are admin-only.
- Custom-field write APIs are admin-only.

## Workspace / multi-tenant model

Up Flow is now multi-workspace. Every Space, Folder, Project and Doc belongs to a
`Workspace` (FK `workspace_id`). Membership is modeled with `WorkspaceMember`
(`role` ∈ `owner | admin | member`). The active workspace is selected via the
`upflow_ws` cookie (not httpOnly) and falls back to the first membership.

Key helpers (`src/lib/workspace.ts`, `src/lib/auth-helpers.ts`):
- `ensurePersonalWorkspace(userId)` — creates a personal workspace on first login.
- `getAuthUser()` enriches the session with `memberships`, `currentWorkspaceId`,
  `currentRole`.
- `isSuperAdmin` — global `User.role === 'admin'` (provisioned via `ADMIN_EMAILS`).
  Bypasses workspace membership checks.
- `isWorkspaceAdmin` — owner/admin in the active workspace OR super-admin. Used
  for destructive workspace operations (custom fields, invites, register).
- `canAccessWorkspace(auth, wsId)` — membership test (or super-admin).

All resource APIs (`/api/spaces`, `/api/folders`, `/api/projects`, `/api/tasks`,
`/api/docs`, `/api/comments`, `/api/search`, `/api/users`) are scoped by the
caller's active workspace. The ClickUp import writes into the active workspace.

New endpoints:
- `GET/POST /api/workspaces` — list / create.
- `POST /api/workspaces/switch` — set the `upflow_ws` cookie.
- `GET/POST /api/invites` — admin-only invite management; POST returns
  `accept_url` (no email delivery in scope).
- `GET/POST /api/invites/accept` — invite lookup + accept (binds the caller to
  the workspace and switches their cookie).

UI:
- `src/components/layout/workspace-switcher.tsx` is mounted at the top of the
  sidebar.
- `src/app/invite/[token]/page.tsx` is the accept page.

DB note: DIRECT_URL in this environment is IPv6-only and unreachable, so
`prisma migrate dev` cannot be used. Apply migrations via
`prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma \
   --script | psql "$DATABASE_URL"` and seed `_prisma_migrations` manually if
needed.

Backfill: the workspace migration explicitly assigns ALL pre-existing Spaces,
Folders, Projects and Docs to a single shared "Acme" workspace (slug `acme`).
This is intentional — Up Flow's day-1 model is a shared org, not per-user silos.
New users auto-join Acme on first login. Personal workspaces are only created
when no Acme exists (e.g. after a fresh DB without seed).

## User preferences

(none recorded yet)
