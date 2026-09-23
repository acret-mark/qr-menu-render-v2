# How Render + Auth.js Replace Vercel + Supabase

**Scope**: a conceptual explainer of what each piece of the original stack (Vercel, Supabase
Postgres, Supabase Auth, Postgres RLS) actually did, and what specifically replaces it in
`qr-menu-render`. For the step-by-step migration plan see
`migration/render-migration-plan.md`; for what's still a real limitation of the free interim
deployment specifically, see `render-free-tier-limitations.md` and
`docs/known-limitations.md`. This doc is the "what and why," not the "what to do next."

## The one-line version

| Old piece | Did what | New piece | Does it how |
|---|---|---|---|
| Vercel | Hosting, build/deploy, cron, edge network | Render Web Service + Render Cron Jobs | Persistent Node process (`next start`), git-triggered deploys, cron as separate scheduled services |
| Supabase Postgres | Managed Postgres | Render Postgres | Managed Postgres — same engine, no `auth` schema |
| Supabase Auth (GoTrue) | Login, sessions, password reset, email confirmation | Auth.js v5 (Credentials provider) | Self-hosted auth logic in the app, backed by the app's own Postgres tables |
| Postgres RLS (`auth.uid()`) | Tenant isolation enforced *at the database* | Application data-access layer | Every query explicitly filters by `owner_id`/admin check, enforced *in code* |

The first row is a hosting swap — mechanical, low-risk. The last two rows are a rewrite of the
app's entire security boundary — Supabase wasn't just "the database," it was the thing silently
deciding who could see which row, and that decision now lives in the app instead of the platform.

## Hosting: Vercel → Render

Vercel ran this app as serverless functions with an edge network and built-in cron. Render runs it
as a **persistent Node process** (`next start` on a Web Service, not `next dev`/serverless
functions) — closer to a traditional VM/container model than Vercel's function-per-request model.
Practical consequences:

- **Cron**: Vercel Cron was a config block (`vercel.json`) hitting existing routes on a schedule.
  Render Cron Jobs are separate deployable services (`type: cron` in `render.yaml`) that do the
  same thing — hit `payment-reminders`/`subscription-expiry` with the same `CRON_SECRET` bearer
  token — but as their own billable service, not a free add-on to the web service (see limitation
  #1 in `render-free-tier-limitations.md` — this is why cron doesn't run at all on the free interim
  tier).
- **Body size limits**: Vercel serverless functions have a hard 4.5MB request-body ceiling, which
  is why `next.config.ts` had a 4MB `bodySizeLimit` workaround. Render's Web Services aren't
  serverless functions, so that ceiling doesn't apply — the workaround is harmless left in place,
  just no longer load-bearing.
- **Deploys**: Both platforms deploy on git push via native GitHub integration — this part didn't
  need to change.
- **Region/edge**: Vercel's edge network sidesteps region choice by design; Render requires picking
  one region per service (`singapore`, chosen once, not re-evaluated since — see
  `render-hosting-report.md` #6).

## Database: Supabase Postgres → Render Postgres

Both are managed Postgres — the data itself moves over cleanly (`pg_dump`/restore). The difference
that actually matters is schema, not the engine: Supabase provisions every project with an `auth`
schema (`auth.users`, `auth.uid()`) that GoTrue and RLS both depend on. Render Postgres is vanilla
Postgres — there is no `auth` schema, so anything that assumed one (foreign keys into `auth.users`,
RLS policies calling `auth.uid()`) has nothing to point at. That gap is what the next two sections
replace.

## Auth: Supabase Auth → Auth.js v5

Supabase Auth (GoTrue) previously handled login, session cookies, password hashing, email
confirmation, and password reset, all server-side and mostly invisible to the app beyond calling
`supabase.auth.*`. Auth.js v5's Credentials provider (`src/lib/auth/auth.config.ts`) does the same
job, but every piece of it is now app code instead of a managed service:

- **Password hashing**: bcrypt via a small wrapper (`src/lib/auth/password.ts`), called from
  `authorize()` — previously GoTrue's job entirely.
- **Sessions**: Auth.js's Credentials provider doesn't support Auth.js's built-in "database"
  session strategy (that only auto-manages sessions for OAuth sign-ins). So sessions here are
  hand-rolled: the JWT carries only an opaque `sessionToken` pointing at a row in a `sessions`
  table (`auth.config.ts`'s `jwt`/`session` callbacks) — deleting that row (e.g. on password
  change, `password.ts`'s `revokeAllSessions`) actually invalidates the session server-side, and
  activity slides the 30-day idle expiry forward. This is what Supabase's cookie-based sessions
  (`@supabase/ssr`) gave for free; here it's ~60 lines of explicit code.
- **Email confirmation**: originally dropped as "not required for v1," then reinstated
  (`specs/011-email-confirmation`) once real registrations needed it. A `emailConfirmationTokens`
  table + a one-time token replace GoTrue's built-in confirmation-link flow; the token is consumed
  exactly once, inside `authorize()`'s `confirmationToken` branch, which is also the only place
  `users.emailVerified` ever gets set.
- **The email itself**: unchanged infrastructure — Gmail SMTP via `nodemailer`
  (`src/lib/email/google-smtp-client.ts`) sent both before and after the migration. What changed is
  who generates the confirmation *link* (the app, not GoTrue).
- **Admin vs. owner**: Supabase had one `auth.users` table with an `admin_users` side table keyed
  off it. Auth.js's `authorize()` reproduces the same split by checking `loginContext: "admin"`
  and `user.isAdmin` before ever creating a session — so a non-admin credential is rejected before
  a cookie exists, not after.

Net effect: nothing about the *user experience* of logging in, registering, confirming email, or
resetting a password changed. What changed is that Auth.js gives none of this for free the way
GoTrue did — every behavior above is explicit, readable code in `src/lib/auth/`, which is also why
it's the part of the migration that took real engineering time (see
`migration/render-migration-plan.md` Phase 1).

## Authorization: Postgres RLS → application data-access layer

This is the part the original cost estimate undersold, and the part actually worth understanding.
Supabase Auth alone didn't make this app multi-tenant-safe — **Postgres Row-Level Security did**,
and RLS depended entirely on Supabase's `auth.uid()`:

- Every tenant table (`businesses`, `categories`, `items`, `subscriptions`, `support_tickets`,
  `ingredients`, and the `*_translations` tables) had an RLS policy that silently filtered every
  query by `auth.uid()` — the app never had to write `WHERE owner_id = ?` anywhere, because the
  database refused to return rows the caller didn't own, no matter what the app's SQL asked for.
- Three `security definer` Postgres functions (`activate_subscription`,
  `grant_active_subscription`, `grant_trial_subscription`) also called an `is_admin()` helper that
  read `auth.uid()` internally.

Render Postgres has no `auth.uid()`, so none of that carries over by changing a connection string
— **there is no database-level safety net anymore.** The replacement is a data-access layer where
every read/write takes the authenticated `ownerId` (from the Auth.js session, not the database) as
an explicit argument and adds it to the query itself. The three Postgres functions were rewritten
to drop their internal `is_admin()` guard and instead trust an admin check already done in the
route/server-action before the function is ever called.

This is the normal pattern for any stack without DB-level RLS (Neon, RDS, Fly Postgres all work
this way) — it's not a Render limitation, it's just a fundamentally different place to put the same
guarantee. The risk is real, though: a missed `owner_id` filter in application code is a
cross-tenant data leak in a way that never existed before, because there's no second layer to catch
it. That's why the migration plan treats this phase as a security review, not a refactor, with an
explicit manual cross-tenant test pass before cutover.

## What didn't change

Cloudinary (images), Gmail SMTP (email transport), Gemini Flash-Lite (AI descriptions), and DeepL
(translation) were never Supabase- or Vercel-coupled, and moved over unmodified.

## Current caveat: the free interim deployment

Everything above describes the target architecture (`main`'s `render.yaml` — Render Starter plan).
The `render-free-interim` branch runs the same Auth.js/data-access code against Render's **free**
tier specifically, which has its own separate set of gaps (no cron at all, 30-day Postgres
expiry, blocked outbound SMTP breaking email delivery) that are about the *hosting tier*, not the
Vercel/Supabase replacement described here — those are tracked in
`render-free-tier-limitations.md`.
