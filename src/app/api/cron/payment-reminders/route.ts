import { queryOne } from "@/lib/db/client";
import { claimDueReminders } from "@/lib/subscription/reminders";
import { sendPaymentReminder } from "@/lib/email/send-payment-reminder";

// Placeholder — exact value not yet confirmed with product (spec.md FR-004,
// Assumptions). Overridable via env without a redeploy once confirmed.
const DEFAULT_THRESHOLD_DAYS = 3;

/**
 * Invoked on a schedule by Render Cron (render.yaml's "payment-reminders"
 * cron service) — never rendered, never reachable as a page. Verifies
 * CRON_SECRET before touching the database or the email provider, since an
 * unauthenticated public GET here would otherwise be a way to trigger
 * arbitrary email sends against every pending subscription.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const thresholdDays = Number(process.env.PAYMENT_REMINDER_THRESHOLD_DAYS) || DEFAULT_THRESHOLD_DAYS;

  const candidates = await claimDueReminders(thresholdDays);

  let sent = 0;
  let failed = 0;

  for (const candidate of candidates) {
    // businesses.contact_email is the wrong field here (nullable, unrelated
    // to login identity) — the owner's account email (users.email, via
    // owner_id) is the same address used for login, matching FR-009.
    const owner = await queryOne<{ name: string; email: string }>(
      `select b.name, u.email
         from businesses b
         join users u on u.id = b.owner_id
         where b.id = $1`,
      [candidate.businessId]
    );

    if (!owner) {
      console.error("Payment reminder: could not resolve business/owner", candidate.businessId);
      failed++;
      continue;
    }

    const result = await sendPaymentReminder({
      toEmail: owner.email,
      businessName: owner.name,
    });

    if (result.ok) {
      sent++;
    } else {
      console.error("Payment reminder send failed", candidate.subscriptionId, result.reason);
      failed++;
    }
  }

  return Response.json({ claimed: candidates.length, sent, failed });
}
