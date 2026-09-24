import { query, queryOne } from "@/lib/db/client";
import { isWithinGrace, newlyCrossedThreshold } from "@/lib/subscription/expiry";
import { sendSubscriptionReminder } from "@/lib/email/send-subscription-reminder";

/**
 * Daily cron (specs/032-unified-subscription-lifecycle) — mirrors
 * src/app/api/cron/payment-reminders/route.ts's shape: CRON_SECRET-gated,
 * never rendered, never reachable as a page.
 *
 * Deliberately separate from payment-reminders — that route governs the
 * unrelated pending-payment nudge with its own `reminder_sent_at` column;
 * this one governs the unified trial+paid expiry lifecycle via
 * `subscriptions.expires_at` / `subscriptions.expiry_reminder_sent_at`.
 *
 * `businesses.status` gets NO new value for lockout — it stays whatever it
 * already is (`active`/`trial`) for the entire locked state, and lockout is
 * a live computation (src/lib/subscription/access-gate.ts) rather than a
 * stored value. This route only ever transitions `subscriptions.status` to
 * `expired` and never writes `businesses.status`.
 */
type DueSubscription = {
  id: string;
  business_id: string;
  plan: string;
  status: string;
  expires_at: string;
  expiry_reminder_sent_at: string | null;
};

async function claimReminderSlot(subscription: DueSubscription, now: Date): Promise<boolean> {
  // Optimistic-concurrency claim: the update only takes effect if
  // expiry_reminder_sent_at still matches the value we read it as, so two
  // overlapping cron runs can't both claim (and thus both email) the same
  // threshold for the same subscription.
  const rows = subscription.expiry_reminder_sent_at
    ? await query<{ id: string }>(
        `update subscriptions set expiry_reminder_sent_at = $1
           where id = $2 and expiry_reminder_sent_at = $3
           returning id`,
        [now.toISOString(), subscription.id, subscription.expiry_reminder_sent_at]
      )
    : await query<{ id: string }>(
        `update subscriptions set expiry_reminder_sent_at = $1
           where id = $2 and expiry_reminder_sent_at is null
           returning id`,
        [now.toISOString(), subscription.id]
      );

  return rows.length > 0;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const now = new Date();

  const subscriptions = await query<DueSubscription>(
    `select id, business_id, plan, status, expires_at, expiry_reminder_sent_at
       from subscriptions
       where status = 'active'
       order by expires_at asc`
  );

  let reminded = 0;
  let locked = 0;
  let failed = 0;

  for (const subscription of subscriptions) {
    if (!subscription.expires_at) continue;

    // --- Reminder thresholds (spec FR-008/FR-009/FR-010) ---
    const threshold = newlyCrossedThreshold(
      subscription.expires_at,
      subscription.expiry_reminder_sent_at,
      now
    );

    if (threshold) {
      const claimed = await claimReminderSlot(subscription, now);

      if (claimed) {
        const business = await queryOne<{ name: string; email: string }>(
          `select b.name, u.email
             from businesses b
             join users u on u.id = b.owner_id
             where b.id = $1`,
          [subscription.business_id]
        );

        if (!business) {
          console.error(
            "Subscription expiry cron: could not resolve business/owner",
            subscription.business_id
          );
          failed++;
        } else {
          const result = await sendSubscriptionReminder({
            toEmail: business.email,
            businessName: business.name,
            isTrial: subscription.plan === "trial",
            threshold,
          });

          if (result.ok) {
            reminded++;
          } else {
            console.error(
              "Subscription expiry cron: reminder send failed",
              subscription.id,
              result.reason
            );
            failed++;
          }
        }
      }
    }

    // --- Grace-period lockout (spec FR-005/FR-007) ---
    if (!isWithinGrace(subscription.expires_at, now)) {
      try {
        const lockedRows = await query<{ id: string }>(
          `update subscriptions set status = 'expired'
             where id = $1 and status = $2
             returning id`,
          [subscription.id, subscription.status]
        );
        if (lockedRows.length > 0) {
          locked++;
        }
      } catch (err) {
        console.error("Subscription expiry cron: failed to lock subscription", subscription.id, err);
        failed++;
      }
    }
  }

  return Response.json({ reminded, locked, failed });
}
