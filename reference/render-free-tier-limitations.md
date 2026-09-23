# Render Free Tier — Limitations Encountered So Far

**Last updated: 2026-09-18.** Summary of what's been confirmed while running `qr-menu-render` on
Render's free tier as an interim deployment (no paid budget approved yet — see
`migration/render-migration-plan.md` for the target paid setup and cost comparison). Full detail
and evidence for each item lives in `qr-menu-render/docs/known-limitations.md` and
`qr-menu-render/docs/render-hosting-report.md`; this file is the short version.

## Confirmed limitations

Verification legend: **Live** = reproduced or observed directly against our own deployment/repo.
**Official docs** = confirmed against Render's own published documentation (checked 2026-09-18).

1. **No free plan for Cron Jobs at all.** ✅ **Live + official docs.** Render's Blueprint
   validator rejected `plan: free` for `type: cron` outright with the literal error `free not a
   valid plan for service type cron` (recorded in `render-free-interim` branch's `render.yaml`
   header comment). Corroborated by Render's own docs
   ([render.com/docs/free](https://render.com/docs/free)), which lists only Web Services, Static
   Sites, Postgres, and Key Value as having a free instance type — Cron Jobs is not among them
   (Render's Cron Job docs additionally state a $1/month minimum charge per cron service, with no
   free option). Result: the `payment-reminders` and `subscription-expiry` scheduled jobs are
   simply not deployed on the free interim branch. Vercel's free Hobby tier includes cron;
   Render's does not.

2. **Free Postgres is deleted, not paused, after 30 days.** ✅ **Live + official docs** (user-confirmed).
   Render's own dashboard states the interim DB (created 2026-09-14) expires and is deleted
   **2026-10-14** unless upgraded. Render's docs confirm the general policy: free Postgres
   databases expire 30 days after creation, with a further 14-day grace period to upgrade before
   deletion. Supabase's free tier pauses an inactive project instead — recoverable, whereas
   Render's free-tier failure mode here destroys the data outright.

3. **Cold starts are real but inconsistent to catch, and more visible than Vercel's.** ✅ **Live**
   (user-confirmed). An automated `curl`-based test (three samples over 20 minutes) never caught
   one — Render's own `healthCheckPath` polling likely kept the service warm during the test. A
   real browser hit after longer idle time triggered Render's full branded "waking up" splash
   screen. Render's docs corroborate the mechanism: a free service spins down after 15 minutes
   with no inbound traffic, and spin-up "takes about one minute," during which Render shows a
   loading page to connecting browsers. Vercel's serverless cold starts are typically
   sub-second-to-a-few-seconds and invisible (no interstitial page).

4. **No SLA / uptime guarantee on free tier.** ⚠️ **Official docs — not directly testable, and not
   found as an explicit exclusion clause.** Render's pricing and plan-comparison pages
   ([render.com/pricing](https://render.com/pricing),
   [render.com/docs/platform-features-by-plan](https://render.com/docs/platform-features-by-plan))
   contain no SLA language for Free/Hobby at all; SLA is described elsewhere as something
   Enterprise-tier customers get ("dedicated support and uptime SLAs"). That's strong circumstantial
   evidence free tier has none, but I could not find a sentence in Render's docs that says so in
   as many words — treat this one as "no SLA is offered or advertised for free tier," not a
   verified negative claim from Render itself.

5. **Outbound SMTP connections don't work on the free-tier web service.** ✅ **Live + official
   docs — fully confirmed, no longer just "likely."** Render's own docs state outright: *"Free web
   services can't send outbound network traffic on ports 25, 465, or 587, commonly used for
   SMTP."* (render.com/docs/free). Render's changelog is explicit about scope: *"free Render web
   services will block outbound network traffic to SMTP ports 25, 465, and 587... To continue
   sending traffic to an SMTP port, you can upgrade your free web service to any paid instance
   type."* (announced 2025-09-16, rolled out across all regions by 2025-09-26). This matches
   exactly what we hit: all transactional email (`sendWelcomeEmail`, password reset, email
   confirmation) goes through Google SMTP via nodemailer (`google-smtp-client.ts`), and on the
   free-tier interim deployment this failed with **ETIMEDOUT**. A fix was tried 2026-09-16 (commit
   `4e222a8`) to fire-and-forget the send instead of awaiting it, so at least the calling form
   wouldn't hang on "Sending..."; it was reverted the next day (`1135082`) because that only hides
   the symptom — the connection is blocked at the platform network level, so the email never sends
   either way, fire-and-forget or not. **Currently unresolved on the free interim branch**: all
   three send paths still `await` the SMTP call, so welcome/password-reset/email-confirmation
   emails do not go out on that deployment, and the calling action can hang while the connection
   times out.

   **Important scope correction: this is a free-instance-type restriction, not a Render-wide one,
   and it does not touch Postgres.** The restriction is tied to the *web service's* compute
   instance plan, not the workspace/organization plan (e.g. a "Hobby" workspace) and not the
   database. Render's own changelog says upgrading the web service to **any** paid instance type
   (ports 465/587 specifically) restores SMTP — only port 25 stays blocked platform-wide, and
   Gmail's SMTP transport doesn't use port 25. `main`'s `render.yaml` (the paid target
   configuration) already runs the web services on `plan: starter`, so **this limitation does not
   apply to the paid target setup at all** — it's purely an artifact of the interim `render.yaml`
   running the web service on `plan: free`. Postgres was never in scope for this restriction
   either way; a database doesn't send outbound SMTP traffic, so there's nothing there to block.

## Latent risks (not a problem yet, worth watching)

- **No Node version pinned** anywhere in the project. ✅ **Live-verified 2026-09-18** by
  inspecting the repo directly: no `.nvmrc`, no `engines` field in `package.json`, no
  `NODE_VERSION` set in either `render.yaml`. (CI's `.github/workflows/pr-checks.yml` does pin
  `NODE_VERSION: 20`, but that only controls GitHub Actions — it has no effect on what Node
  version Render's build/runtime uses.) Render could silently change its default Node version out
  from under the app.
- **Region choice (`singapore`) was a one-time manual decision**, not a default. ✅
  **Live-verified 2026-09-18**: every service and database in both `render.yaml` (paid target,
  `main`) and the free-interim branch's `render.yaml` is hardcoded to `region: singapore`, set
  once and never re-evaluated. Worth reconfirming before paid cutover, since Vercel's edge network
  sidesteps this choice entirely.

## What this means in practice

- Anything depending on the daily payment-reminder/subscription-expiry jobs does not run on this
  interim deployment. Trigger those routes manually (`curl` + `CRON_SECRET` bearer token) if
  needed for testing/demos.
- Registration, password reset, and email confirmation do not deliver email on this deployment —
  the flows still complete (accounts get created, tokens get issued), but the user never receives
  the email that's supposed to follow. Anything gated on receiving one of these emails needs a
  manual workaround (e.g. reading the token directly from the DB) while testing on free tier.
- This is not a production-ready setup — production traffic must not run on it.
- These findings are also the evidence backing the paid-tier request in
  `specs/003-render-feasibility-poc` (~$13/mo, Render Starter + Postgres Basic).

## Path off these limitations

Resolved once the paid-tier request is approved: switch deployment from the `render-free-interim`
branch to `main` (already written, cron jobs included). See `migration/render-migration-plan.md`
for the full cutover plan.

## Sources checked for verification (2026-09-18)

- [render.com/docs/free](https://render.com/docs/free) — free-tier service types, SMTP port
  block, Postgres 30-day expiry + 14-day grace period, 15-minute spin-down.
- [render.com/changelog/free-web-services-will-no-longer-allow-outbound-traffic-to-smtp-ports](https://render.com/changelog/free-web-services-will-no-longer-allow-outbound-traffic-to-smtp-ports) —
  SMTP port block announcement and rollout date.
- [render.com/docs/cronjobs](https://render.com/docs/cronjobs) — Cron Job minimum charge, no free
  option.
- [render.com/pricing](https://render.com/pricing) and
  [render.com/docs/platform-features-by-plan](https://render.com/docs/platform-features-by-plan) —
  no SLA language found for Free/Hobby.
- This repo: `render.yaml` (both branches), git history (`4e222a8`, `1135082`), `package.json`.
