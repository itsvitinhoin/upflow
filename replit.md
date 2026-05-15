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

## User preferences

(none recorded yet)
